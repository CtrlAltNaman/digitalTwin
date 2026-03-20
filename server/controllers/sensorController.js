const SensorData = require("../models/SensorData");
const { getNodePredictions } = require("../services/mlService");

// POST /api/sensor-data
// Receives sensor data from hardware gateway or simulator
const createSensorData = async (req, res) => {
  try {
    const {
      deviceId,
      temperature,
      vibration,
      rpm,
      temperature2,
      humidity,
      flowRate,
    } = req.body;

    // ── Per-node ML predictions ──────────────────────────────────
    const predictions = await getNodePredictions({
      temperature,
      vibration,
      rpm,
      temperature2,
      humidity,
      flowRate,
    }).catch((err) => {
      console.error("ML prediction failed, using defaults:", err.message);
      return {
        "Slave-1": { status: "normal", risk_score: 0 },
        "Slave-2": { status: "normal", risk_score: 0 },
        "Master":  { status: "normal", risk_score: 0 },
      };
    });

    const nodeStatus = {
      Master:    predictions["Master"].status,
      "Slave-1": predictions["Slave-1"].status,
      "Slave-2": predictions["Slave-2"].status,
    };
    const riskScores = {
      Master:    predictions["Master"].risk_score,
      "Slave-1": predictions["Slave-1"].risk_score,
      "Slave-2": predictions["Slave-2"].risk_score,
    };

    // Overall status = Master's verdict (worst of both slaves)
    const status = nodeStatus.Master;

    const sensorData = await SensorData.create({
      deviceId,
      temperature,
      vibration,
      rpm,
      temperature2,
      humidity,
      flowRate,
      status,
      nodeStatus,
      riskScores,
    });

    // Emit real-time update — includes nodeStatus so the 3D scene updates immediately
    const io = req.app.get("io");
    io.emit("sensorUpdate", sensorData);

    res.status(201).json({ success: true, data: sensorData });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// GET /api/sensor-history
// Returns historical sensor data with optional filters
const getSensorHistory = async (req, res) => {
  try {
    const { deviceId, limit = 50, from, to } = req.query;

    const filter = {};

    if (deviceId) {
      filter.deviceId = deviceId;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const data = await SensorData.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/predict
// Runs the XGBoost model on manually entered values — no DB write
const predictRisk = async (req, res) => {
  try {
    const { temperature, vibration, rpm, temperature2, humidity, flowRate } = req.body;

    const predictions = await getNodePredictions({
      temperature:  parseFloat(temperature)  || 0,
      vibration:    parseFloat(vibration)    || 0,
      rpm:          parseFloat(rpm)          || 0,
      temperature2: parseFloat(temperature2) || 0,
      humidity:     parseFloat(humidity)     || 0,
      flowRate:     parseFloat(flowRate)     || 0,
    });

    res.status(200).json({ success: true, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { createSensorData, getSensorHistory, predictRisk };
