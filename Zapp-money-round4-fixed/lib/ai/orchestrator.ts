// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aiDecision(user: any, amount: number) {
  if (amount > (user?.avg_tx || 100) * 5) {
    return {
      decision: "REVIEW",
      rail: "WALLET",
      confidence: 0.6
    }
  }

  return {
    decision: "FAST",
    rail: "WALLET",
    confidence: 0.9
  }
}