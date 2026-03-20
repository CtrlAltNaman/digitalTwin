/**
 * ML Service — bridges Node.js ↔ Python XGBoost service
 *
 * Primary path:   POST /predict/batch on the Python Flask service
 * Fallback path:  threshold-based rule engine (no Python required)
 *
 * The batch endpoint receives slave feature subsets and returns
 * per-node { status, risk_score } for Slave-1, Slave-2, and Master.
 */

const axios = require("axios");

const ML_API_URL = process.env.PYTHON_ML_URL || "http://localhost:8000/predict/batch";
const TIMEOUT_MS = 3000; // abort if Python doesn't respond in 3 s

// ─────────────────────────────────────────────────────────────
// Real prediction via XGBoost Python service
// ─────────────────────────────────────────────────────────────
async function callPythonService(slave1Features, slave2Features) {
  const response = await axios.post(
    ML_API_URL,
    { slave1: slave1Features, slave2: slave2Features },
    { timeout: TIMEOUT_MS }
  );
  return response.data; // { Slave-1: {...}, Slave-2: {...}, Master: {...} }
}

// ─────────────────────────────────────────────────────────────
// Threshold fallback (runs when Python service is down)
// ─────────────────────────────────────────────────────────────
function thresholdStatus(params) {
  const breaches = [
    (params.temperature  ?? 0) >= 80,
    (params.vibration    ?? 0) >= 6,
    (params.rpm          ?? 0) >= 1800,
    (params.temperature2 ?? 0) >= 80,
    (params.humidity     ?? 0) >= 80,
    (params.flowRate     ?? 0) >= 180,
  ].filter(Boolean).length;

  if (breaches >= 2) return { status: "critical", risk_score: 0.9 };
  if (breaches === 1) return { status: "warning",  risk_score: 0.5 };
  return               { status: "normal",   risk_score: 0.1 };
}

function fallbackPrediction(slave1Features, slave2Features) {
  const s1 = thresholdStatus(slave1Features);
  const s2 = thresholdStatus(slave2Features);
  const priority = { normal: 0, warning: 1, critical: 2 };
  const masterStatus = priority[s1.status] >= priority[s2.status] ? s1.status : s2.status;

  return {
    "Slave-1": s1,
    "Slave-2": s2,
    "Master":  { status: masterStatus, risk_score: Math.max(s1.risk_score, s2.risk_score) },
  };
}

// ─────────────────────────────────────────────────────────────
// Main export — called by sensorController
// ─────────────────────────────────────────────────────────────
async function getNodePredictions(sensorData) {
  // Slave-1 owns: temperature (T1), vibration, rpm
  const slave1Features = {
    temperature: sensorData.temperature,
    vibration:   sensorData.vibration,
    rpm:         sensorData.rpm,
  };

  // Slave-2 owns: temperature2 (T2), humidity, flowRate
  const slave2Features = {
    temperature2: sensorData.temperature2,
    humidity:     sensorData.humidity,
    flowRate:     sensorData.flowRate,
  };

  try {
    const result = await callPythonService(slave1Features, slave2Features);
    console.log(`[ML] XGBoost → S1:${result["Slave-1"].status} S2:${result["Slave-2"].status} M:${result["Master"].status}`);
    return result;
  } catch (err) {
    console.warn(`[ML] Python service unavailable (${err.message}), using threshold fallback`);
    return fallbackPrediction(slave1Features, slave2Features);
  }
}

module.exports = { getNodePredictions };
