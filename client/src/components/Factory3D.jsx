import { Suspense, useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Text } from "@react-three/drei";
import Wire from "./Wire";

/* ═══════════════════════════════════════════════════
   FULL PARAMETER REGISTRY — all 6 sensors
   key        → field name in the socket/API data
   label      → full display name
   short      → abbreviation for 3D floating text
   unit, crit, max → thresholds and scale
═══════════════════════════════════════════════════ */
const ALL_PARAMS = {
  temperature:  { key: "temperature",  label: "Temperature-1", short: "T1",  unit: "°C",   crit: 80,   max: 120  },
  vibration:    { key: "vibration",    label: "Vibration",     short: "VIB", unit: "mm/s", crit: 6,    max: 10   },
  rpm:          { key: "rpm",          label: "RPM",           short: "RPM", unit: "rpm",  crit: 1800, max: 2000 },
  temperature2: { key: "temperature2", label: "Temperature-2", short: "T2",  unit: "°C",   crit: 80,   max: 120  },
  humidity:     { key: "humidity",     label: "Humidity",      short: "HUM", unit: "%",    crit: 80,   max: 100  },
  flowRate:     { key: "flowRate",     label: "Flow Rate",     short: "FLOW",unit: "L/m",  crit: 180,  max: 200  },
};

/* ═══════════════════════════════════════════════════
   NODE LAYOUT — triangle: 1 master + 2 slaves
   Each node declares which parameters it owns.
   Master owns all (union of both slaves).
═══════════════════════════════════════════════════ */
const MACHINES = [
  {
    name:     "Master",
    isMaster: true,
    position: [0, 0, -6],
    params:   ["temperature", "vibration", "rpm", "temperature2", "humidity", "flowRate"],
  },
  {
    name:     "Slave-1",
    isMaster: false,
    position: [-5.5, 0, 4],
    params:   ["temperature", "vibration", "rpm"],
  },
  {
    name:     "Slave-2",
    isMaster: false,
    position: [5.5, 0, 4],
    params:   ["temperature2", "humidity", "flowRate"],
  },
];

/* ═══════════════════════════════════════════════════
   ALL-TO-ALL WIRE GENERATOR — C(3,2) = 3 wires
═══════════════════════════════════════════════════ */
const WIRE_DEFS = (() => {
  const wires = [];
  let paramIdx = 0;

  for (let i = 0; i < MACHINES.length; i++) {
    for (let j = i + 1; j < MACHINES.length; j++) {
      const from = MACHINES[i].position;
      const to   = MACHINES[j].position;
      const dx   = to[0] - from[0];
      const dz   = to[2] - from[2];
      const len  = Math.sqrt(dx * dx + dz * dz);
      const nx   = dx / len;
      const nz   = dz / len;
      const OFF  = 1.3;
      const paramKeys = Object.keys(ALL_PARAMS);
      const p = ALL_PARAMS[paramKeys[paramIdx % paramKeys.length]];
      paramIdx++;

      wires.push({
        id:       `wire-${i}-${j}`,
        fromNode: MACHINES[i].name,
        toNode:   MACHINES[j].name,
        start:    [from[0] + nx * OFF, -0.3, from[2] + nz * OFF],
        end:      [to[0]   - nx * OFF, -0.3, to[2]   - nz * OFF],
        param:    p.key,
        crit:     p.crit,
        label:    p.short,
      });
    }
  }
  return wires;
})();

const STATUS_PRIORITY = { normal: 0, warning: 1, critical: 2 };

/* ═══════════════════════════════════════════════════
   STATUS PALETTE
═══════════════════════════════════════════════════ */
const STATUS_PALETTE = {
  normal:   { body: "#22c55e", emissive: "#22c55e", emissiveIntensity: 0.12, light: "#22c55e", lightIntensity: 0.8  },
  warning:  { body: "#eab308", emissive: "#eab308", emissiveIntensity: 0.25, light: "#eab308", lightIntensity: 1.4  },
  critical: { body: "#ef4444", emissive: "#ef4444", emissiveIntensity: 0.55, light: "#ef4444", lightIntensity: 2.5  },
};

function resolveStatus(data) {
  if (data?.status && STATUS_PALETTE[data.status]) return data.status;
  const t = data?.temperature ?? 0;
  if (t >= 80) return "critical";
  if (t >= 60) return "warning";
  return "normal";
}

/* ═══════════════════════════════════════════════════
   NODE INFO CARD — HTML overlay (not 3D)
   Appears over the canvas when a machine is clicked.
   Shows full parameter table with progress bars.
═══════════════════════════════════════════════════ */
const STATUS_TEXT_CLASS = {
  normal:   "text-green-400",
  warning:  "text-yellow-400",
  critical: "text-red-400",
};

const STATUS_BORDER_COLOR = {
  normal:   "rgba(34,197,94,0.25)",
  warning:  "rgba(234,179,8,0.25)",
  critical: "rgba(239,68,68,0.25)",
};

const STATUS_BG_COLOR = {
  normal:   "rgba(34,197,94,0.08)",
  warning:  "rgba(234,179,8,0.08)",
  critical: "rgba(239,68,68,0.08)",
};

function NodeInfoCard({ nodeName, isMaster, nodeParams, data, onClose }) {
  const nodeStatusFromData = data?.nodeStatus?.[nodeName];
  const status = nodeStatusFromData && STATUS_PALETTE[nodeStatusFromData]
    ? nodeStatusFromData
    : resolveStatus(data);
  const textClass  = STATUS_TEXT_CLASS[status];
  const borderColor = STATUS_BORDER_COLOR[status];
  const bgColor     = STATUS_BG_COLOR[status];

  return (
    <div
      className="absolute top-3 right-3 w-72 rounded-xl z-10 backdrop-blur-md overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, background: "rgba(13,19,33,0.96)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor, background: bgColor }}
      >
        <div className="flex items-center gap-2.5">
          {/* Status dot */}
          <span
            className={`w-2.5 h-2.5 rounded-full ${status === "critical" ? "animate-pulse" : ""}`}
            style={{ background: STATUS_PALETTE[status].body }}
          />
          <div>
            <p className="text-sm font-bold text-gray-100 leading-tight">{nodeName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${isMaster ? "text-blue-400" : "text-slate-500"}`}>
                {isMaster ? "◆ Master" : "● Slave"}
              </span>
              <span className="text-gray-600">·</span>
              <span className={`text-[10px] font-mono uppercase tracking-widest ${textClass}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* ── Parameter rows ── */}
      <div className="px-4 py-3 space-y-4">
        {nodeParams.map((key) => { const cfg = ALL_PARAMS[key]; if (!cfg) return null;
          const val    = data?.[cfg.key] ?? null;
          const isCrit = val !== null && val >= cfg.crit;
          const pct    = val !== null ? Math.min(100, (val / cfg.max) * 100) : 0;
          const critPct = (cfg.crit / cfg.max) * 100;
          const barColor = isCrit ? "#ef4444" : "#22c55e";

          return (
            <div key={cfg.key}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400 font-medium">{cfg.label}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: barColor }}
                  >
                    {val !== null ? Number(val).toFixed(1) : "--"}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">{cfg.unit}</span>
                  {isCrit && (
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">
                      CRIT
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 bg-panel-900/80 rounded-full overflow-visible">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: barColor }}
                />
                {/* Critical threshold tick mark */}
                <div
                  className="absolute top-[-3px] w-px h-[12px] rounded-full"
                  style={{ left: `${critPct}%`, background: "rgba(239,68,68,0.7)" }}
                />
              </div>

              {/* Range labels */}
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-gray-700 font-mono">0</span>
                <span className="text-[9px] text-gray-600 font-mono">
                  crit: {cfg.crit}{cfg.unit}
                </span>
                <span className="text-[9px] text-gray-700 font-mono">
                  {cfg.max}{cfg.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div
        className="px-4 py-2 border-t flex items-center justify-between"
        style={{ borderColor }}
      >
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">
          Live · updates every 1s
        </span>
        <span className={`text-[10px] font-mono font-bold uppercase ${textClass}`}>
          {status === "normal" ? "Operational" : status === "warning" ? "Caution" : "Alert"}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROTOR
═══════════════════════════════════════════════════ */
function Rotor({ rpm = 0 }) {
  const bladeRef = useRef();
  const speed    = (rpm || 0) / 100000;

  useFrame(() => {
    if (bladeRef.current) bladeRef.current.rotation.y += speed;
  });

  return (
    <group position={[0, 0.85, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.5, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={1} roughness={0.1} />
      </mesh>
      <group ref={bladeRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[1.6, 0.07, 0.16]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, Math.PI / 2]} castShadow>
          <boxGeometry args={[1.6, 0.07, 0.16]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/* ═══════════════════════════════════════════════════
   MACHINE — single factory node
   • onClick   → calls onSelect to open the info card
   • isSelected → renders a selection ring + outline glow
   • Pointer events change cursor to show it's clickable
═══════════════════════════════════════════════════ */
function Machine({ data = {}, position = [0, 0, 0], name = "Node", isMaster = false, isSelected, onSelect, nodeStatus: nodeStatusProp }) {
  const groupRef   = useRef();
  const ringRef    = useRef();
  const resolved   = nodeStatusProp && STATUS_PALETTE[nodeStatusProp] ? nodeStatusProp : resolveStatus(data);
  const status     = resolved;
  const palette    = STATUS_PALETTE[status];
  const rpm        = data?.rpm ?? 0;
  const isCritical = status === "critical";
  const colors     = useMemo(() => palette, [status]); // eslint-disable-line

  /* Master is slightly larger; slaves are standard scale */
  const scale = isMaster ? 1.25 : 1.0;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t   = clock.elapsedTime;
    const amp = (rpm / 1000) * 0.008 + (isCritical ? 0.012 : 0);
    groupRef.current.position.y = position[1] + Math.sin(t * 12) * amp;

    /* Pulse the selection ring opacity */
    if (ringRef.current && isSelected) {
      ringRef.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.25;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={()  => { document.body.style.cursor = "default";  }}
    >
      {/* Inner group scaled by role */}
      <group scale={[scale, scale, scale]}>

        {/* Selection ring */}
        {isSelected && (
          <mesh
            ref={ringRef}
            position={[0, -0.62, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[1.55, 1.85, 48]} />
            <meshBasicMaterial
              color={colors.body}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Base plate — gold trim for master */}
        <mesh position={[0, -0.7, 0]} receiveShadow>
          <boxGeometry args={[2.8, 0.15, 2.8]} />
          <meshStandardMaterial
            color={isMaster ? "#1e3a5f" : "#0f172a"}
            metalness={1}
            roughness={0.5}
          />
        </mesh>

        {/* Main body */}
        <mesh castShadow>
          <boxGeometry args={[1.8, 1.1, 1.0]} />
          <meshStandardMaterial
            color={colors.body}
            metalness={0.9}
            roughness={0.2}
            emissive={colors.emissive}
            emissiveIntensity={isSelected ? colors.emissiveIntensity + 0.25 : colors.emissiveIntensity}
          />
        </mesh>

        {/* Control box — accent blue top on master, dark on slaves */}
        <mesh position={[0, 0.88, 0]} castShadow>
          <boxGeometry args={[0.85, 0.42, 0.85]} />
          <meshStandardMaterial
            color={isMaster ? "#1d4ed8" : "#1e293b"}
            metalness={0.95}
            roughness={0.15}
            emissive={isMaster ? "#1d4ed8" : "#000000"}
            emissiveIntensity={isMaster ? 0.3 : 0}
          />
        </mesh>

        {/* Indicator panel */}
        <mesh position={[0, 0, 0.52]} castShadow>
          <boxGeometry args={[0.55, 0.38, 0.02]} />
          <meshStandardMaterial
            color={colors.body}
            emissive={colors.emissive}
            emissiveIntensity={isCritical ? 1.4 : 0.45}
          />
        </mesh>

        <Rotor rpm={rpm} />

        {/* Status underlight */}
        <pointLight
          position={[0, -0.5, 0]}
          intensity={isSelected ? colors.lightIntensity * 1.6 : colors.lightIntensity}
          color={colors.light}
          distance={5}
          decay={2}
        />

      </group>

      {/* ── Labels (outside scaled group so text stays readable size) ── */}

      {/* Role badge — MASTER or SLAVE */}
      <Text
        position={[0, isMaster ? 4.0 : 3.5, 0]}
        fontSize={isMaster ? 0.22 : 0.18}
        color={isMaster ? "#60a5fa" : "#64748b"}
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
        depthTest={false}
        font={undefined}
      >
        {isMaster ? "◆ MASTER" : "● SLAVE"}
      </Text>

      {/* Node name */}
      <Text
        position={[0, isMaster ? 3.65 : 3.18, 0]}
        fontSize={0.25}
        color={isSelected ? "#f1f5f9" : "#94a3b8"}
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
        depthTest={false}
      >
        {name}
      </Text>

      {/* Status label */}
      <Text
        position={[0, isMaster ? 3.33 : 2.88, 0]}
        fontSize={0.18}
        color={colors.body}
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
        depthTest={false}
      >
        {status.toUpperCase()}
      </Text>

    </group>
  );
}

/* ═══════════════════════════════════════════════════
   FLOOR
═══════════════════════════════════════════════════ */
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#020617" metalness={0.4} roughness={0.8} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════
   SCENE LIGHTS
═══════════════════════════════════════════════════ */
function SceneLights({ status }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[10, 18, 10]}
        intensity={1.3}
        color="#60a5fa"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 12, 0]} intensity={1.0} color="#3b82f6" distance={40} />
      {status === "critical" && (
        <pointLight position={[0, 10, 0]} intensity={3.5} color="#ef4444" distance={30} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   FACTORY3D — main export
═══════════════════════════════════════════════════ */
export default function Factory3D({ data = {} }) {
  const status                        = resolveStatus(data);
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="relative w-full h-[340px] sm:h-[420px] lg:h-[500px] rounded-xl overflow-hidden border border-panel-500/20 bg-black">

      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 11, 20], fov: 58 }}
        gl={{ antialias: true }}
        /* Click on empty canvas → deselect */
        onPointerMissed={() => {
          setSelectedNode(null);
          document.body.style.cursor = "default";
        }}
      >
        <color attach="background" args={["#010b1a"]} />
        <fog attach="fog" args={["#010b1a", 25, 55]} />

        <SceneLights status={status} />

        <OrbitControls
          enableDamping
          dampingFactor={0.07}
          minDistance={8}
          maxDistance={35}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0, 0]}
        />

        <Suspense fallback={null}>
          <Environment preset="warehouse" />
        </Suspense>

        <Grid
          args={[50, 50]}
          position={[0, -1.59, 0]}
          cellColor="#1e3a5f"
          sectionColor="#1e40af"
          cellSize={1}
          sectionSize={5}
          fadeDistance={35}
          fadeStrength={1}
          infiniteGrid
        />

        <Floor />

        {MACHINES.map((m) => (
          <Machine
            key={m.name}
            name={m.name}
            position={m.position}
            isMaster={m.isMaster}
            data={data}
            nodeStatus={data?.nodeStatus?.[m.name]}
            isSelected={selectedNode === m.name}
            onSelect={() =>
              setSelectedNode((prev) => (prev === m.name ? null : m.name))
            }
          />
        ))}

        {WIRE_DEFS.map((w) => {
          const s1 = data?.nodeStatus?.[w.fromNode] ?? "normal";
          const s2 = data?.nodeStatus?.[w.toNode]   ?? "normal";
          const wireStatus = STATUS_PRIORITY[s1] >= STATUS_PRIORITY[s2] ? s1 : s2;
          return (
            <Wire
              key={w.id}
              start={w.start}
              end={w.end}
              status={wireStatus}
              value={data?.[w.param] ?? 0}
              crit={w.crit}
              label={w.label}
            />
          );
        })}
      </Canvas>

      {/* HTML info card — rendered outside Canvas, over the 3D scene */}
      {selectedNode && (
        <NodeInfoCard
          nodeName={selectedNode}
          isMaster={MACHINES.find((m) => m.name === selectedNode)?.isMaster ?? false}
          nodeParams={MACHINES.find((m) => m.name === selectedNode)?.params ?? []}
          data={data}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Hint when nothing is selected */}
      {!selectedNode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 border border-panel-500/20 pointer-events-none">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">
            Click any node to inspect
          </p>
        </div>
      )}
    </div>
  );
}
