"""
serial_reader.py — Factory Digital Twin
========================================
Reads sensor data from hardware (STM32 / nRF / Arduino) via serial port
and forwards it to the Node.js backend at POST /api/sensor-data.

Architecture
------------
  ┌─────────────┐  queue  ┌──────────────┐  HTTP POST  ┌───────────┐
  │ Serial port │ ──────► │ Sender thread│ ──────────► │ Node.js   │
  │ (reader)    │         │ (background) │             │ + ML Flask│
  └─────────────┘         └──────────────┘             └───────────┘
       │ never blocks on HTTP              Socket.io ↓
       ▼                                  ┌───────────┐
  zero data loss                          │ Dashboard │
                                          └───────────┘

Supported line formats (auto-detected per line):
  1. JSON      {"temperature":65.2,"vibration":3.5,"rpm":1450,
                "temperature2":60.1,"humidity":45.2,"flowRate":120.3}
  2. Labeled   T1:65.2,VIB:3.5,RPM:1450,T2:60.1,HUM:45.2,FLOW:120.3
  3. Plain CSV 65.2,3.5,1450,60.1,45.2,120.3
               (order: temperature, vibration, rpm, temperature2, humidity, flowRate)

Usage:
    pip install pyserial requests
    python serial_reader.py                        # COM9, 115200 baud
    python serial_reader.py --port COM3 --baud 9600
    python serial_reader.py --list                 # show available ports
"""

import argparse
import json
import queue
import re
import sys
import threading
import time
from typing import Optional

DEBUG = False   # set to True via --debug flag

import requests
import serial
import serial.tools.list_ports

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_PORT    = "COM9"
DEFAULT_BAUD    = 250000
API_URL         = "http://localhost:5000/api/sensor-data"
DEVICE_ID       = "factory-unit-01"
RECONNECT_DELAY = 3      # seconds before retry on disconnect
QUEUE_MAX       = 50     # max buffered readings (drop oldest if full)

# ── Arduino CSV column map ────────────────────────────────────────────────────
# Format from master node: slave1_id, T1, VIB, RPM, slave2_id, T2, HUM, FLOW, [status]
# None = skip that column (slave node IDs / status flags)
CSV_ORDER = [None, "temperature", "vibration", "rpm", None, "temperature2", "humidity", "flowRate"]

# ── Label aliases  ────────────────────────────────────────────────────────────
ALIASES = {
    "temperature":  ["temperature", "temp", "t1", "TEMP", "TEMP1", "TEMPERATURE"],
    "vibration":    ["vibration",   "vib",  "VIB", "VIBRATION", "accel", "ACCEL"],
    "rpm":          ["rpm",  "RPM",  "speed", "SPEED", "motor_rpm"],
    "temperature2": ["temperature2","temp2","t2","T2","TEMP2","TEMPERATURE2"],
    "humidity":     ["humidity",    "hum",  "HUM", "HUMIDITY", "rh", "RH"],
    "flowRate":     ["flowrate","flowRate","flow","FLOW","FLOW_RATE","flow_rate"],
}

# Fields the backend schema requires — default to 0 if hardware omits them
REQUIRED_FIELDS = ["temperature", "rpm", "humidity", "flowRate"]

# ── Shared state ──────────────────────────────────────────────────────────────
_send_queue: queue.Queue = queue.Queue(maxsize=QUEUE_MAX)
_stats = {"read": 0, "sent": 0, "errors": 0, "dropped": 0}
_stop_event = threading.Event()


# ─────────────────────────────────────────────────────────────────────────────
# Parsing helpers
# ─────────────────────────────────────────────────────────────────────────────

def resolve_key(raw: str) -> Optional[str]:
    k = raw.strip()
    for canon, aliases in ALIASES.items():
        if k.lower() in [a.lower() for a in aliases]:
            return canon
    return None


def parse_line(line: str) -> Optional[dict]:
    """
    Try JSON → labeled key:value → plain CSV.
    Returns a dict of {field: float} or None if the line is not sensor data.
    """
    line = line.strip()
    if not line:
        return None

    # ── JSON ──────────────────────────────────────────────────────────────────
    if line.startswith("{"):
        try:
            obj = json.loads(line)
            result = {}
            for raw_k, v in obj.items():
                canon = resolve_key(str(raw_k))
                if canon:
                    try:
                        result[canon] = float(v)
                    except (ValueError, TypeError):
                        pass
            return result or None
        except json.JSONDecodeError:
            pass

    # ── Labeled  e.g.  T1:65.2,VIB:3.5,RPM:1450 ────────────────────────────
    if ":" in line or "=" in line:
        tokens = re.split(r"[,;\s]+", line)
        result = {}
        for token in tokens:
            m = re.match(r"^([A-Za-z_]\w*)[=:]([+-]?\d+\.?\d*)$", token)
            if not m:
                continue
            canon = resolve_key(m.group(1))
            if canon:
                try:
                    result[canon] = float(m.group(2))
                except ValueError:
                    pass
        if len(result) >= 2:
            return result

    # ── Plain CSV  e.g.  1,0.00,0.00,0.00,2,26.69,59.24,0.00,0 ─────────────
    parts = line.split(",")
    if len(parts) >= 3:
        result = {}
        for i, part in enumerate(parts[: len(CSV_ORDER)]):
            field = CSV_ORDER[i]
            if field is None:          # skip node-ID / status columns
                continue
            try:
                result[field] = float(part.strip())
            except ValueError:
                pass
        if len(result) >= 3:
            return result

    return None


def fill_required(data: dict) -> dict:
    for field in REQUIRED_FIELDS:
        data.setdefault(field, 0.0)
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Sender thread  —  runs in background, never blocks the serial reader
# ─────────────────────────────────────────────────────────────────────────────

def _sender_thread(api_url: str, device_id: str) -> None:
    session = requests.Session()   # keep-alive connection to backend

    while not _stop_event.is_set():
        try:
            data = _send_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        payload = {"deviceId": device_id, **data}
        try:
            resp = session.post(api_url, json=payload, timeout=5)
            _stats["sent"] += 1

            if resp.ok:
                body = resp.json()
                ns = body.get("data", {}).get("nodeStatus", {})
                rs = body.get("data", {}).get("riskScores", {})
                s1 = ns.get("Slave-1", "?")
                s2 = ns.get("Slave-2", "?")
                m  = ns.get("Master",  "?")
                r1 = round(float(rs.get("Slave-1", 0)), 2)
                r2 = round(float(rs.get("Slave-2", 0)), 2)
                rm = round(float(rs.get("Master",  0)), 2)
                _print(
                    f"  ML → S1:{s1}({r1})  "
                    f"S2:{s2}({r2})  Master:{m}({rm})"
                )
            else:
                _stats["errors"] += 1
                _print(f"  Backend error [{resp.status_code}]: {resp.text[:80]}")

        except requests.ConnectionError:
            _stats["errors"] += 1
            _print("  Backend not reachable — is the Node.js server running?")
        except requests.Timeout:
            _stats["errors"] += 1
            _print("  Backend timeout (>5 s)")
        except Exception as exc:
            _stats["errors"] += 1
            _print(f"  Send error: {exc}")
        finally:
            _send_queue.task_done()


# ─────────────────────────────────────────────────────────────────────────────
# Stats printer  —  runs in background, prints once per second
# ─────────────────────────────────────────────────────────────────────────────

def _stats_thread() -> None:
    prev_read = 0
    prev_sent = 0
    while not _stop_event.is_set():
        time.sleep(1)
        r = _stats["read"]
        s = _stats["sent"]
        hz_r = r - prev_read
        hz_s = s - prev_sent
        prev_read = r
        prev_sent = s
        q = _send_queue.qsize()
        _print(
            f"  [stats] {hz_r} read/s  {hz_s} sent/s  "
            f"queue:{q}  total read:{r}  errors:{_stats['errors']}  "
            f"dropped:{_stats['dropped']}",
            flush=True,
        )


_print_lock = threading.Lock()

def _print(*args, flush=False, **kwargs):
    with _print_lock:
        print(*args, **kwargs)
        if flush:
            sys.stdout.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Main reader loop
# ─────────────────────────────────────────────────────────────────────────────

def run(port: str, baud: int, api_url: str, device_id: str, debug: bool = False) -> None:
    global DEBUG
    DEBUG = debug
    _print("=" * 60)
    _print("  Factory Digital Twin — Real-Time Serial Reader")
    _print("=" * 60)
    _print(f"  Port  : {port}  |  Baud : {baud}")
    _print(f"  Target: {api_url}")
    _print(f"  Device: {device_id}")
    _print("  Press Ctrl+C to stop.\n")

    # Start background sender thread
    sender = threading.Thread(
        target=_sender_thread, args=(api_url, device_id),
        daemon=True, name="sender",
    )
    sender.start()

    # Start stats thread
    stats = threading.Thread(
        target=_stats_thread, daemon=True, name="stats"
    )
    stats.start()

    while not _stop_event.is_set():
        try:
            # dsrdtr=False  → stops DTR from toggling on connect,
            #                  which would reset the Arduino Uno bootloader
            # rtscts=False  → no hardware flow control (Arduino doesn't use it)
            with serial.Serial(
                port, baud,
                timeout=0.1,
                dsrdtr=False,
                rtscts=False,
            ) as ser:
                # Explicitly hold DTR low so the Uno doesn't reset mid-session
                ser.dtr = False
                _print(f"[Serial] Connected to {port} @ {baud} baud")
                _print(f"[Serial] Waiting 2 s for Arduino to boot …")
                time.sleep(2)          # Arduino Uno takes ~2 s after USB connect
                ser.reset_input_buffer()   # discard any garbage from bootloader
                _print(f"[Serial] Listening for data …\n")
                _buf = b""

                while not _stop_event.is_set():
                    chunk = ser.read(ser.in_waiting or 1)
                    if not chunk:
                        continue

                    if DEBUG:
                        _print(f"[HEX]   {chunk.hex(' ')}")

                    _buf += chunk

                    # Split on \r\n, bare \r, or bare \n — handles all STM32/nRF variants
                    parts = re.split(b'\r\n|\r|\n', _buf)
                    _buf = parts[-1]          # last part may be incomplete
                    complete_lines = parts[:-1]

                    for raw_line in complete_lines:
                        if not raw_line:
                            continue

                        try:
                            line = raw_line.decode("utf-8", errors="replace")
                        except Exception:
                            continue

                        # Always print the raw line exactly as received from hardware
                        _print(f"[COM]   {line.strip()}")

                        data = parse_line(line)

                        if data is None:
                            # Not sensor data — firmware debug print
                            if DEBUG:
                                _print(f"[SKIP]  (no fields parsed from above line)")
                            continue

                        fill_required(data)
                        _stats["read"] += 1

                        fields = "  ".join(
                            f"{k}={round(v,2)}" for k, v in sorted(data.items())
                        )
                        _print(f"[Data]  {fields}")

                        # Push to sender — drop oldest if queue is full
                        try:
                            _send_queue.put_nowait(data)
                        except queue.Full:
                            try:
                                _send_queue.get_nowait()   # discard oldest
                            except queue.Empty:
                                pass
                            _send_queue.put_nowait(data)
                            _stats["dropped"] += 1

        except serial.SerialException as exc:
            _print(f"[Serial] {exc}")
            _print(f"[Serial] Retrying in {RECONNECT_DELAY} s ...\n")
            time.sleep(RECONNECT_DELAY)

        except KeyboardInterrupt:
            break

    _print("\n[Serial] Stopping …")
    _stop_event.set()
    sender.join(timeout=3)
    _print("[Serial] Done.")


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Factory Digital Twin — Serial → Backend bridge (real-time)"
    )
    parser.add_argument("--port",   default=DEFAULT_PORT, help=f"Serial port  (default: {DEFAULT_PORT})")
    parser.add_argument("--baud",   default=DEFAULT_BAUD, type=int, help=f"Baud rate    (default: {DEFAULT_BAUD})")
    parser.add_argument("--api",    default=API_URL,      help=f"Backend URL  (default: {API_URL})")
    parser.add_argument("--device", default=DEVICE_ID,    help=f"Device ID    (default: {DEVICE_ID})")
    parser.add_argument("--list",   action="store_true",  help="List available serial ports and exit")
    parser.add_argument("--debug",  action="store_true",  help="Print raw hex bytes and skipped lines for diagnosis")
    args = parser.parse_args()

    if args.list:
        ports = serial.tools.list_ports.comports()
        if ports:
            print("Available serial ports:")
            for p in sorted(ports):
                print(f"  {p.device:<12} {p.description}")
        else:
            print("No serial ports found.")
    else:
        run(args.port, args.baud, args.api, args.device, debug=args.debug)
