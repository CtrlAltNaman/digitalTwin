const { Parser } = require("json2csv");
const SensorData = require("../models/SensorData");

// GET /api/export-csv
// Fetches all sensor data from MongoDB, converts to CSV, sends as download
const exportCSV = async (req, res) => {
  try {
    const { deviceId, from, to } = req.query;

    // Build filter
    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    // Fetch data sorted oldest → newest (chronological for ML)
    const sensorData = await SensorData.find(filter)
      .sort({ createdAt: 1 })
      .lean();

    if (sensorData.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No sensor data found to export",
      });
    }

    // Define CSV columns matching the current 6-sensor schema
    const fields = [
      { label: "Timestamp",          value: (row) => new Date(row.createdAt).toISOString() },
      { label: "Device ID",          value: "deviceId"     },
      { label: "Temperature-1 (°C)", value: "temperature"  },
      { label: "Vibration (mm/s)",   value: "vibration"    },
      { label: "RPM",                value: "rpm"          },
      { label: "Temperature-2 (°C)", value: "temperature2" },
      { label: "Humidity (%)",       value: "humidity"     },
      { label: "Flow Rate (L/min)",  value: "flowRate"     },
      { label: "Status",             value: "status"       },
      { label: "Status Master",      value: (row) => row.nodeStatus?.Master    ?? "" },
      { label: "Status Slave-1",     value: (row) => row.nodeStatus?.["Slave-1"] ?? "" },
      { label: "Status Slave-2",     value: (row) => row.nodeStatus?.["Slave-2"] ?? "" },
      { label: "Risk Master",        value: (row) => row.riskScores?.Master    ?? "" },
      { label: "Risk Slave-1",       value: (row) => row.riskScores?.["Slave-1"] ?? "" },
      { label: "Risk Slave-2",       value: (row) => row.riskScores?.["Slave-2"] ?? "" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(sensorData);

    // Generate filename with date range
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `sensor-data-${timestamp}.csv`;

    // Send as downloadable CSV file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = { exportCSV };
