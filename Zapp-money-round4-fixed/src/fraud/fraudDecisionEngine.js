export function computeRiskScore(features) {
  let score = 0.05;

  score += Math.min(features.velocityPerMinute / 20, 0.3);
  score += Math.min(features.frequencyPerHour / 80, 0.25);
  score += Math.min(features.amountDeviation / 5, 0.2);
  score += Math.min(features.countryRisk, 0.2);
  score += Math.min(features.relationshipSpread / 40, 0.1);

  return Math.max(0, Math.min(score, 1));
}

export function classifyFraudRisk(score) {
  if (score >= 0.9) return "BLOCK";
  if (score >= 0.7) return "HIGH";
  if (score >= 0.35) return "MEDIUM";
  return "LOW";
}

export function makeFraudDecision(features) {
  const score = computeRiskScore(features);
  const level = classifyFraudRisk(score);

  const confidence = Math.min(
    0.55 + (features.velocityPerMinute > 3 ? 0.1 : 0) + (features.amountDeviation > 1 ? 0.15 : 0) + (features.countryRisk > 0.5 ? 0.1 : 0),
    0.98
  );

  return { score, level, confidence };
}
