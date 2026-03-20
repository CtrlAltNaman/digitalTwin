const express = require("express");
const router = express.Router();
const { createSensorData, getSensorHistory, predictRisk } = require("../controllers/sensorController");
const { exportCSV } = require("../controllers/exportController");

// POST /api/sensor-data  — receive data from hardware/simulator
router.post("/sensor-data", createSensorData);

// GET /api/sensor-history — fetch historical readings
router.get("/sensor-history", getSensorHistory);

// GET /api/export-csv — download all sensor data as CSV
router.get("/export-csv", exportCSV);

// POST /api/predict — manual prediction without saving to DB
router.post("/predict", predictRisk);

module.exports = router;
