const historyByEntity = new Map();

function updateHistory(entityId, point) {
  if (!entityId) return [];
  const existing = historyByEntity.get(entityId) || [];
  existing.push(point);
  const recent = existing.slice(-200);
  historyByEntity.set(entityId, recent);
  return recent;
}

export function extractFraudFeatures(eventPacket) {
  // Support both plain objects (direct call) and event-bus-wrapped {type, payload} objects
  const payload = eventPacket.payload ?? eventPacket;
  const amount = Number(payload.amount || 0);
  const entityId = payload.entityId || payload.from || payload.userId || null;
  const countryRisk = Number(payload.countryRisk || 0);
  const createdAt = Date.now();

  const history = updateHistory(entityId, {
    amount,
    at: createdAt,
    geo: payload.geo || payload.country || null,
    to: payload.to || null,
  });

  const inLastMinute = history.filter((item) => createdAt - item.at <= 60_000);
  const inLastHour = history.filter((item) => createdAt - item.at <= 3_600_000);

  const avgAmount = inLastHour.length
    ? inLastHour.reduce((sum, item) => sum + item.amount, 0) / inLastHour.length
    : amount;

  const amountDeviation = avgAmount > 0 ? Math.max((amount - avgAmount) / avgAmount, 0) : 0;

  const relationshipSpread = new Set(inLastHour.map((item) => item.to).filter(Boolean)).size;

  return {
    entityId,
    amount,
    velocityPerMinute: inLastMinute.length,
    frequencyPerHour: inLastHour.length,
    amountDeviation,
    countryRisk,
    relationshipSpread,
    hasGeoSignal: Boolean(payload.geo || payload.country),
    sourceType: eventPacket.type,
    transactionId: eventPacket.transactionId || null,
  };
}
