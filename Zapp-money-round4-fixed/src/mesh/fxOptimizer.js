export function optimizeFX({ amount = 0, spread = 0.002, volatility = 0.01, liquidityPressure = 0.5 }) {
  const expectedSavings = amount * spread * (1 - liquidityPressure);
  if (volatility > 0.05 && liquidityPressure < 0.4) return { action: "DELAY", expectedSavings, confidence: 0.7 };
  if (amount < 5000) return { action: "BATCH", expectedSavings: expectedSavings * 0.6, confidence: 0.65 };
  if (spread > 0.01 && liquidityPressure > 0.8) return { action: "ARBITRAGE", expectedSavings: expectedSavings * 1.5, confidence: 0.72 };
  return { action: "CONVERT_NOW", expectedSavings, confidence: 0.8 };
}
