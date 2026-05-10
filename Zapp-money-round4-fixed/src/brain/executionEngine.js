import { MoneyEngine } from "../core/moneyEngine.js";
import { riskGovernor } from "./riskGovernor.js";
import { circuitBreaker } from "./circuitBreaker.js";
import { systemGovernor } from "../governance/systemGovernor.js";

const dailyMovement = new Map();

export class ExecutionEngine {
  constructor({ maxTransactionSize = 50000, maxDailyMovement = 250000, minConfidence = 0.7 } = {}) {
    this.maxTransactionSize = maxTransactionSize;
    this.maxDailyMovement = maxDailyMovement;
    this.minConfidence = minConfidence;
  }

  todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  canExecute(decision) {
    if (!decision || decision.action !== "MOVE_FUNDS") return { ok: false, reason: "NON_EXECUTABLE_ACTION" };
    if (decision.confidence < this.minConfidence) return { ok: false, reason: "LOW_CONFIDENCE" };
    if (decision.riskLevel === "HIGH") return { ok: false, reason: "HIGH_RISK_BLOCK" };
    if (Number(decision.amount || 0) > this.maxTransactionSize) return { ok: false, reason: "MAX_TX_SIZE_EXCEEDED" };

    const key = this.todayKey();
    const moved = dailyMovement.get(key) || 0;
    if (moved + Number(decision.amount || 0) > this.maxDailyMovement) return { ok: false, reason: "MAX_DAILY_MOVEMENT_EXCEEDED" };

    return { ok: true, reason: "OK" };
  }

  async execute(decision) {
    const validation = this.canExecute(decision);
    if (!validation.ok) return { executed: false, reason: validation.reason };

    if (await circuitBreaker.isActive()) return { executed: false, reason: "CIRCUIT_BREAKER_ACTIVE" };

    const governor = await riskGovernor.canExecute(decision);
    if (!governor.ok) return { executed: false, reason: governor.reason };

    const globalGov = await systemGovernor.canExecute({ amount: decision.amount, risk: decision.risk || 0, type: "brain_move" });
    if (!globalGov.ok) return { executed: false, reason: globalGov.reason };

    try {
      const result = await MoneyEngine.createTransaction({
        type: "brain_move",
        amount: Number(decision.amount || 0),
        currency: decision.currency || "USD",
        from: decision.from,
        to: decision.to,
        risk: 0,
      });

      const key = this.todayKey();
      dailyMovement.set(key, (dailyMovement.get(key) || 0) + Number(decision.amount || 0));
      await riskGovernor.registerExecution(decision);
      await systemGovernor.registerExecution({ amount: decision.amount, type: "brain_move" });
      circuitBreaker.recordExecutionResult(true);

      return { executed: true, reason: "EXECUTED", result };
    } catch (error) {
      circuitBreaker.recordExecutionResult(false);
      return { executed: false, reason: "EXECUTION_FAILED", error: error.message };
    }
  }
}

export const executionEngine = new ExecutionEngine();
