const history = new Map();

function pairKey(region, currency) {
  return `${region}:${currency}`;
}

export const liquidityPredictor = {
  ingestTransaction({ region = "GLOBAL", currency = "USD", amount = 0 }) {
    const key = pairKey(region, currency);
    const arr = history.get(key) || [];
    arr.push({ amount: Number(amount), ts: Date.now() });
    history.set(key, arr.slice(-500));
  },

  predictDemand(region, currency) {
    const arr = history.get(pairKey(region, currency)) || [];
    if (!arr.length) return { demand: 0, confidence: 0.5 };
    const lastHour = arr.filter((x) => Date.now() - x.ts <= 3600_000);
    const demand = lastHour.reduce((sum, x) => sum + x.amount, 0);
    const confidence = Math.min(0.55 + (lastHour.length / 100), 0.95);
    return { demand, confidence };
  },
};
