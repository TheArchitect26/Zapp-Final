export function calculateCorridorProfitability({ volume = 0, feeRevenue = 0, fxCost = 0, liquidityCost = 0 }) {
  const profit = Number(feeRevenue) - Number(fxCost) - Number(liquidityCost);
  const margin = volume > 0 ? profit / volume : 0;
  return { profit, margin };
}
