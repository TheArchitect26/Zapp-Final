import { runConsensusProposal } from "../../consensusEngine.js";
import { controlPlane } from "../../controlPlane.js";
import { MoneyEngine } from "../../core/moneyEngine.js";
import { fraudScore, classifyRisk } from "../../services/fraudAI.service.js";

/**
 * POST /api/v1/transactions
 * Risk score is ALWAYS computed server-side — never accepted from the client.
 */
export async function createTransaction(req, res, next) {
  try {
    const {
      fromAccountId,
      toAccountId,
      amount,
      currency = "ZAR",
      type = "transfer",
      // NOTE: any `risk` field sent by the client is intentionally ignored below
    } = req.body ?? {};

    if (!fromAccountId || !toAccountId || !amount || Number(amount) <= 0 || !currency) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT" });
    }

    // Ensure the caller can only send from their own account
    if (fromAccountId !== req.user?.id) {
      return res.status(403).json({ success: false, error: "ACCOUNT_MISMATCH" });
    }

    controlPlane.assert("write");

    // Compute risk server-side — never trust the client's value
    const serverRisk = await fraudScore({
      amount: Number(amount),
      entityId: fromAccountId,
      velocity: 1,
      countryRisk: 0,
    });

    const riskLevel = classifyRisk(serverRisk);
    if (riskLevel === "HIGH") {
      return res.status(403).json({
        success: false,
        status: "DECLINED_FRAUD_AI",
        risk: serverRisk,
        riskLevel,
      });
    }

    const idempotencyKey = req.headers["idempotency-key"] || null;
    let consensus = null;

    if (Number(amount) > Number(process.env.CONSENSUS_THRESHOLD || 1000)) {
      controlPlane.assert("consensus");
      consensus = await runConsensusProposal({
        amount: Number(amount),
        risk: serverRisk,
      });
      if (!consensus.quorum) {
        return res.status(202).json({
          success: false,
          status: "CONSENSUS_PENDING_REPLAY",
          consensus,
        });
      }
    }

    const result = await MoneyEngine.createTransaction(
      {
        type,
        from: String(fromAccountId),
        to: String(toAccountId),
        amount: Number(amount),
        currency: String(currency).toUpperCase(),
        risk: serverRisk,  // always the server-computed value
      },
      idempotencyKey
    );

    return res.status(201).json({
      success: true,
      transactionId: result.transaction?.id || result.transactionId || result.id,
      status: result.settlement?.status || "PENDING",
      consensus,
    });
  } catch (error) {
    return next(error);
  }
}
