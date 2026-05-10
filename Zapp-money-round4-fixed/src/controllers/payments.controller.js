import { z } from "zod";
import { broadcast } from "../realtime/socket.server.js";
import { fraudScore, learnFraud, classifyRisk } from "../services/fraudAI.service.js";
import { hasSufficientFunds } from "../services/balance.service.js";
import { MoneyEngine } from "../core/moneyEngine.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { runFraudPipeline } from "../fraud/fraudPipeline.js";

const chargeSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  from: z.string().min(2),
  to: z.string().min(2),
  velocity: z.number().nonnegative().default(1),
  entityId: z.string().min(1).optional(),
}).refine((data) => data.from !== data.to, {
  message: "SELF_TRANSFER_NOT_ALLOWED",
  path: ["to"],
});

export async function charge(req, res) {
  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "INVALID_REQUEST", details: parsed.error.flatten() });
  }

  const { amount, currency, from, to, velocity, entityId } = parsed.data;

  // Ownership check — caller may only charge from their own account
  if (from !== req.user?.id) {
    return res.status(403).json({ success: false, error: "SENDER_MISMATCH" });
  }

  const enoughBalance = await hasSufficientFunds(from, amount, currency);
  if (!enoughBalance) {
    return res.status(400).json({ success: false, error: "INSUFFICIENT_FUNDS" });
  }

  // Run the full fraud pipeline — emits FRAUD_SCORE_GENERATED, FRAUD_DECISION_MADE,
  // and FRAUD_BLOCK_TRANSACTION events so moneyEngine.js fraud gate fires correctly.
  const fraudResult = await runFraudPipeline({ amount, currency, velocity, entityId, from, to });
  const { finalScore: risk, enforcement } = fraudResult;
  const riskLevel = fraudResult.decision.level;

  if (enforcement === "BLOCK" || enforcement === "REVIEW") {
    await learnFraud({ entityId, amount, velocity, risk, outcome: "declined" });
    broadcast("fraud_alert", { entityId, amount, risk, riskLevel, status: "DECLINED" });
    return res.json({ success: false, status: "DECLINED_FRAUD_AI", risk, riskLevel });
  }

  const idempotencyKey = req.headers["idempotency-key"] || null;
  const result = await MoneyEngine.createTransaction({ type: "charge", amount, currency, from, to, risk, fraudEnforcement: enforcement }, idempotencyKey);

  broadcast("payment_created", { transaction: result.transaction, risk, riskLevel });
  broadcast("settlement_queued", { transactionId: result.transaction.id, status: "PENDING", settlementId: result.settlement?.id });
  await learnFraud({ entityId, amount, velocity, risk, outcome: "approved" });

  return res.json({ success: true, transaction: result.transaction, risk, riskLevel, settlement: "queued" });
}
