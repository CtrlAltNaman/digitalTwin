/**
 * Hardware Simulator
 *
 * Mimics the STM32 → nRF → Gateway pipeline by sending
 * randomized but realistic sensor data to the Express API
 * every 1 second via HTTP POST.
 *
 * Usage: node simulator.js
 */

const http = require("http");

const API_URL    = "http://localhost:5000/api/sensor-data";
const DEVICE_ID  = "factory-unit-01";
const INTERVAL_MS = 1000;

// ── Sensor config — matches the 6-parameter schema ──────────────
// Slave-1: temperature, vibration, rpm
// Slave-2: temperature2, humidity, flowRate
const sensorConfig = {
  temperature:  { base: 65,   drift: 15,  unit: "°C"    },
  vibration:    { base: 3.5,  drift: 2.5, unit: "mm/s"  },
  rpm:          { base: 1450, drift: 200, unit: "RPM"   },
  temperature2: { base: 60,   drift: 15,  unit: "°C"    },
  humidity:     { base: 45,   drift: 10,  unit: "%"     },
  flowRate:     { base: 120,  drift: 30,  unit: "L/min" },
};

// Smooth random walk — values drift gradually instead of jumping
const state = {};
for (const [key, cfg] of Object.entries(sensorConfig)) {
  state[key] = cfg.base;
}

function generateSensorData() {
  for (const [key, cfg] of Object.entries(sensorConfig)) {
    const step = (Math.random() - 0.5) * cfg.drift * 0.2;
    state[key] += step;

    const min = cfg.base - cfg.drift;
    const max = cfg.base + cfg.drift;
    state[key] = Math.max(min, Math.min(max, state[key]));
  }

  return {
    deviceId:     DEVICE_ID,
    temperature:  parseFloat(state.temperature.toFixed(2)),
    vibration:    parseFloat(state.vibration.toFixed(3)),
    rpm:          Math.round(state.rpm),
    temperature2: parseFloat(state.temperature2.toFixed(2)),
    humidity:     parseFloat(state.humidity.toFixed(2)),
    flowRate:     parseFloat(state.flowRate.toFixed(2)),
  };
}

function sendData(data) {
  const body = JSON.stringify(data);

  const url = new URL(API_URL);
  const options = {
    hostname: url.hostname,
    port:     url.port,
    path:     url.pathname,
    method:   "POST",
    headers: {
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = http.request(options, (res) => {
    let responseBody = "";
    res.on("data", (chunk) => (responseBody += chunk));
    res.on("end", () => {
      if (res.statusCode === 201) {
        const parsed = JSON.parse(responseBody);
        const ns = parsed?.data?.nodeStatus ?? {};
        console.log(
          `[${new Date().toLocaleTimeString()}] ` +
          `T1:${data.temperature}°C VIB:${data.vibration}mm/s RPM:${data.rpm} | ` +
          `T2:${data.temperature2}°C H:${data.humidity}% F:${data.flowRate}L/min ` +
          `→ S1:${ns["Slave-1"] ?? "?"} S2:${ns["Slave-2"] ?? "?"} M:${ns.Master ?? "?"}`
        );
      } else {
        console.error(`[ERROR] Status ${res.statusCode}: ${responseBody}`);
      }
    });
  });

  req.on("error", (err) => {
    console.error(`[ERROR] Cannot reach server: ${err.message}`);
  });

  req.write(body);
  req.end();
}

// ── Main loop ────────────────────────────────────────────────────
console.log("=== Factory Digital Twin — Hardware Simulator ===");
console.log(`Target:   ${API_URL}`);
console.log(`Device:   ${DEVICE_ID}`);
console.log(`Interval: ${INTERVAL_MS}ms`);
console.log("Press Ctrl+C to stop.\n");

setInterval(() => {
  const data = generateSensorData();
  sendData(data);
}, INTERVAL_MS);
