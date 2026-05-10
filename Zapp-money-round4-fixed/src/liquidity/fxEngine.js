export const fxEngine = {
  optimizeConversion({ fromCurrency, toCurrency, amount, spread = 0.002 }) {
    const shouldBatch = amount < 5_000;
    const expectedCost = Number(amount || 0) * spread;
    return {
      action: shouldBatch ? "BATCH" : "EXECUTE",
      fromCurrency,
      toCurrency,
      amount: Number(amount || 0),
      expectedCost,
      delayMs: shouldBatch ? 60_000 : 0,
    };
  },
};
