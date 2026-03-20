const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      default: "factory-unit-01",
    },

    // ── Slave-1 sensors ──
    temperature: { type: Number, required: true },
    vibration:   { type: Number, default: null },
    rpm:         { type: Number, required: true },

    // ── Slave-2 sensors ──
    temperature2: { type: Number, default: null },
    humidity:     { type: Number, required: true },
    flowRate:     { type: Number, required: true },

    // ── Overall ML status (backward compat) ──
    status: {
      type: String,
      enum: ["normal", "warning", "critical"],
      default: "normal",
    },

    // ── Per-node ML predictions ──
    // Stored as Mixed so hyphenated keys work cleanly
    nodeStatus: {
      type: mongoose.Schema.Types.Mixed,
      default: { Master: "normal", "Slave-1": "normal", "Slave-2": "normal" },
    },

    // ── Per-node risk scores (0.0 – 1.0) ──
    riskScores: {
      type: mongoose.Schema.Types.Mixed,
      default: { Master: 0, "Slave-1": 0, "Slave-2": 0 },
    },
  },
  { timestamps: true }
);

sensorDataSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model("SensorData", sensorDataSchema);
