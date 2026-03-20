"""
ML Service — Digital Twin Dashboard
Loads the XGBoost model via joblib and serves predictions.

Run:
    pip install -r requirements.txt
    python app.py
"""

import os
import traceback

import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Load model ────────────────────────────────────────────────────────────────
_here = os.path.dirname(os.path.abspath(__file__))
_default = os.path.join(_here, "xgboost_failure_risk_model.pkl")
if not os.path.exists(_default):
    _default = os.path.join(_here, "..", "xgboost_failure_risk_model.pkl")

MODEL_PATH = os.environ.get("MODEL_PATH", _default)

model = None
try:
    model = joblib.load(MODEL_PATH)
    print(f"[ML] Model loaded: {MODEL_PATH}")
    print(f"[ML] Model type : {type(model).__name__}")
except FileNotFoundError:
    print(f"[ML] WARNING — model not found at: {MODEL_PATH}")
except Exception as e:
    print(f"[ML] ERROR loading model: {e}")
    traceback.print_exc()


# ── Core prediction ───────────────────────────────────────────────────────────

def run_model(temperature, vibration, rpm, temperature2, humidity, flowRate):
    """
    Call the XGBoost model exactly as it was trained.
    Feature names: N1_temp, N1_vib, N1_rpm, N2_temp, N2_humidity, N2_flow
    Returns: { status, risk_score, no_risk_prob, risk_prob, source }
    """
    sample = pd.DataFrame([{
        "N1_temp":     float(temperature),
        "N1_vib":      float(vibration),
        "N1_rpm":      float(rpm),
        "N2_temp":     float(temperature2),
        "N2_humidity": float(humidity),
        "N2_flow":     float(flowRate),
    }])

    pred  = model.predict(sample)[0]
    prob  = model.predict_proba(sample)[0]

    status     = "critical" if pred == 1 else "normal"
    risk_prob  = round(float(prob[1]), 4)
    no_risk_prob = round(float(prob[0]), 4)

    print(f"[ML] pred={pred}  no-risk={no_risk_prob*100:.1f}%  risk={risk_prob*100:.1f}%  → {status.upper()}")

    return {
        "status":       status,
        "risk_score":   risk_prob,
        "no_risk_prob": no_risk_prob,
        "risk_prob":    risk_prob,
        "source":       "model",
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":       "ok",
        "model_loaded": model is not None,
        "model_type":   type(model).__name__ if model else None,
        "features":     ["N1_temp", "N1_vib", "N1_rpm", "N2_temp", "N2_humidity", "N2_flow"],
    })


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """
    Called by Node.js with:
        { "slave1": { temperature, vibration, rpm },
          "slave2": { temperature2, humidity, flowRate } }

    Returns:
        { "Slave-1": {...}, "Slave-2": {...}, "Master": {...} }
    """
    try:
        body   = request.get_json(force=True) or {}
        slave1 = body.get("slave1", {})
        slave2 = body.get("slave2", {})

        if model is None:
            err = {"status": "normal", "risk_score": 0, "source": "no_model"}
            return jsonify({"Slave-1": err, "Slave-2": err, "Master": err})

        result = run_model(
            temperature  = slave1.get("temperature",  0),
            vibration    = slave1.get("vibration",    0),
            rpm          = slave1.get("rpm",          0),
            temperature2 = slave2.get("temperature2", 0),
            humidity     = slave2.get("humidity",     0),
            flowRate     = slave2.get("flowRate",     0),
        )

        # Master = full model result
        # Slaves share the same verdict (model evaluates the whole system)
        return jsonify({
            "Slave-1": result,
            "Slave-2": result,
            "Master":  result,
        })

    except Exception as e:
        print(f"[ML] Batch error: {e}")
        traceback.print_exc()
        fallback = {"status": "normal", "risk_score": 0, "source": "error"}
        return jsonify({"Slave-1": fallback, "Slave-2": fallback, "Master": fallback})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"[ML] Starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
