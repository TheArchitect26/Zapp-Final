import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { extractFraudFeatures } from "./featureExtractor.js";
import { makeFraudDecision } from "./fraudDecisionEngine.js";
import { modelService } from "../ml/modelService.js";
import { logger } from "../lib/logger.js";

export async function runFraudPipeline(eventPacket) {
  const features = extractFraudFeatures(eventPacket);

  const ruleDecision = makeFraudDecision(features);

  let mlScore = ruleDecision.score;
  let modelSource = "heuristic";

  try {
    const prediction = await modelService.predict(features);
    mlScore = Number(prediction.score || mlScore);
    modelSource = prediction.source || modelSource;
  } catch (error) {
    logger.warn("model predict fallback", { error: error.message });
  }

  const finalScore =
    Math.max(
      0,
      Math.min((mlScore * 0.7) + (ruleDecision.score * 0.3), 1)
    );

  const decision = makeFraudDecision({
    ...features,
    amountDeviation: finalScore * 5,
  });

  /* =========================================================
     FRAUD RESULT OBJECT (SOURCE OF TRUTH)
  ========================================================= */
  const enforcement =
    finalScore >= 0.85 ? "BLOCK"
    : finalScore >= 0.65 ? "REVIEW"
    : finalScore >= 0.4  ? "THROTTLE"
    : "ALLOW";

  const fraudResult = {
    transactionId: features.transactionId,
    entityId: features.entityId,
    risk: finalScore,
    riskLevel: decision.level,
    confidence: decision.confidence,
    mlScore,
    ruleScore: ruleDecision.score,
    modelSource,
    enforcement,
  };

  /* =========================================================
     INTELLIGENCE EVENTS (OBSERVATION LAYER)
  ========================================================= */
  eventBus.emit(
    EVENT_TYPES.FRAUD_SCORE_GENERATED,
    { ...fraudResult, source: "fraud.pipeline" },
    { transactionId: features.transactionId }
  );

  eventBus.emit(
    EVENT_TYPES.FRAUD_DECISION_MADE,
    fraudResult,
    { transactionId: features.transactionId }
  );

  /* =========================================================
     ENFORCEMENT EVENTS — emitted after final decision is built
  ========================================================= */
  if (enforcement === "BLOCK") {
    eventBus.emit(
      EVENT_TYPES.FRAUD_BLOCK_TRANSACTION,
      { ...fraudResult, action: "BLOCK", reason: "HIGH_RISK_SCORE" },
      { transactionId: features.transactionId }
    );
  } else if (enforcement === "REVIEW") {
    eventBus.emit(
      EVENT_TYPES.FRAUD_REVIEW_REQUIRED,
      { ...fraudResult, action: "REVIEW" },
      { transactionId: features.transactionId }
    );
  } else if (enforcement === "THROTTLE") {
    eventBus.emit(
      EVENT_TYPES.FRAUD_THROTTLE_RECOMMENDED,
      { ...fraudResult, action: "THROTTLE" },
      { transactionId: features.transactionId }
    );
  }

  if (decision.level === "HIGH" || decision.level === "BLOCK") {
    eventBus.emit(
      EVENT_TYPES.FRAUD_ALERT_HIGH_RISK,
      fraudResult,
      { transactionId: features.transactionId }
    );
  }

  return { features, decision, finalScore, enforcement };