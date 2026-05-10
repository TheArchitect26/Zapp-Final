import os
import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Zapp ML Service")
model = None


@app.on_event("startup")
def load_model():
    global model
    path = os.getenv("MODEL_PATH", "models/fraud_model.pkl")
    if os.path.exists(path):
        model = joblib.load(path)


class PredictRequest(BaseModel):
    amount: float
    user_trust: float = 0.5
    tx_count: int = 1
    velocity: int = 1


class PredictResponse(BaseModel):
    score: float
    rail: str
    confidence: float
    source: str


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    features = np.array([[req.amount, req.user_trust, req.tx_count, req.velocity]])
    if model is not None:
        score = float(model.predict_proba(features)[0][1])
        source = "model"
    else:
        score = min(0.05 + (req.amount / 100000) * 0.3 + (req.velocity / 10) * 0.2, 1.0)
        source = "heuristic"
    rail = "WALLET" if score < 0.3 else "BANK" if score < 0.6 else "MANUAL_REVIEW"
    confidence = 1.0 - score if rail == "WALLET" else score
    return PredictResponse(score=score, rail=rail, confidence=confidence, source=source)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}
