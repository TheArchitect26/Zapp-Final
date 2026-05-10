const rates = new Map([
  ["USD:USD", 1],
  ["USD:EUR", 0.92],
  ["EUR:USD", 1.08],
  ["USD:NGN", 1450],
  ["NGN:USD", 1/1450],
]);

export function getFXRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;
  const direct = rates.get(`${fromCurrency}:${toCurrency}`);
  if (direct) return direct;
  const viaUsdA = rates.get(`${fromCurrency}:USD`);
  const viaUsdB = rates.get(`USD:${toCurrency}`);
  if (viaUsdA && viaUsdB) return viaUsdA * viaUsdB;
  return 1;
}
