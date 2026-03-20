/**
 * Wire.jsx — Animated pipe connecting two 3D points
 *
 * Color logic:
 *   status === "critical"  →  RED   #ef4444  (pulsing glow + thickness pulse)
 *   status === "warning"   →  AMBER #eab308
 *   otherwise              →  GREEN #22c55e  (healthy)
 *
 * `status` prop takes priority. If omitted, falls back to value >= crit check.
 *
 * All animation runs inside useFrame directly on material/mesh refs.
 * Zero React re-renders during animation.
 *
 * Props:
 *   start   [x,y,z]  — start world position
 *   end     [x,y,z]  — end world position
 *   status  string   — "normal" | "warning" | "critical"  (direct override)
 *   value   number   — current sensor reading  (used when status is not provided)
 *   crit    number   — threshold above which wire turns red (used with value)
 *   label   string   — short label shown at arc midpoint
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

/* ── Static color targets — created once, reused every frame ── */
const COLOR_NORMAL   = new THREE.Color("#22c55e");
const COLOR_WARNING  = new THREE.Color("#eab308");
const COLOR_CRITICAL = new THREE.Color("#ef4444");

export default function Wire({
  start  = [0, 0, 0],
  end    = [1, 0, 0],
  status = null,   // "normal" | "warning" | "critical" — overrides value/crit
  value  = 0,
  crit   = 80,
  label  = "",
}) {
  const matRef  = useRef();
  const meshRef = useRef();

  /* ── Build tube geometry once from start → arc-midpoint → end ──
     Arc height scales with wire length so short and long wires
     both look natural.                                           ── */
  const geometry = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const len = s.distanceTo(e);

    const mid = new THREE.Vector3()
      .addVectors(s, e)
      .multiplyScalar(0.5)
      .setY(Math.max(s.y, e.y) + len * 0.12);

    const curve = new THREE.CatmullRomCurve3([s, mid, e]);
    return new THREE.TubeGeometry(curve, 24, 0.055, 8, false);
  }, [start[0], start[1], start[2], end[0], end[1], end[2]]); // eslint-disable-line

  /* ── Label position — top of the arc ── */
  const labelPos = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const len = s.distanceTo(e);
    return [
      (s.x + e.x) / 2,
      Math.max(s.y, e.y) + len * 0.12 + 0.55,
      (s.z + e.z) / 2,
    ];
  }, [start[0], start[1], start[2], end[0], end[1], end[2]]); // eslint-disable-line

  /* ── Per-frame: lerp color + pulse emissive + scale on critical ── */
  useFrame(({ clock }) => {
    const mat  = matRef.current;
    const mesh = meshRef.current;
    if (!mat) return;

    // Resolve effective state — status prop wins, fallback to value threshold
    const effective = status != null
      ? status
      : (value != null && !isNaN(value) && value >= crit ? "critical" : "normal");

    const isCritical = effective === "critical";
    const target = effective === "critical" ? COLOR_CRITICAL
                 : effective === "warning"  ? COLOR_WARNING
                 : COLOR_NORMAL;

    /* Smooth color transition */
    mat.color.lerp(target, 0.07);
    mat.emissive.lerp(target, 0.07);

    if (isCritical) {
      const t = clock.elapsedTime;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 6 * Math.PI) * 0.4;

      if (mesh) {
        const s = 1 + Math.sin(t * 6 * Math.PI) * 0.1;
        mesh.scale.x += (s - mesh.scale.x) * 0.12;
        mesh.scale.z += (s - mesh.scale.z) * 0.12;
        mesh.scale.y = 1;
      }
    } else {
      mat.emissiveIntensity += (0 - mat.emissiveIntensity) * 0.07;
      if (mesh) {
        mesh.scale.x += (1 - mesh.scale.x) * 0.1;
        mesh.scale.z += (1 - mesh.scale.z) * 0.1;
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          ref={matRef}
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0}
          metalness={0.6}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>

      {label && (
        <Text
          position={labelPos}
          fontSize={0.18}
          color="#475569"
          anchorX="center"
          anchorY="middle"
          renderOrder={1}
          depthTest={false}
        >
          {label}
        </Text>
      )}
    </group>
  );
}
