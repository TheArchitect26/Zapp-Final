export function allocateLiquidity({ demand = 0, available = 0, reserve = 0, confidence = 0.6 }) {
  if (available < reserve) return { action: "PRE_FUND", amount: reserve - available, confidence };
  if (demand > available * 0.8) return { action: "REBALANCE", amount: demand - available * 0.5, confidence };
  if (available > demand * 2) return { action: "WITHDRAW", amount: (available - demand) * 0.25, confidence };
  return { action: "HOLD", amount: 0, confidence };
}
