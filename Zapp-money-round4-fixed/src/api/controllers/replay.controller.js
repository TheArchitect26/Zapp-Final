import { db } from "../../db/index.js";
import { settleTransaction } from "../../core/moneyEngine.js";
import { controlPlane } from "../../controlPlane.js";

export async function replayTransaction(req, res, next) {
  try {
    controlPlane.assert("replay");
    const { id } = req.params;
    const mode = String(req.body?.mode || "SAFE").toUpperCase();
    if (!["DRY_RUN", "SAFE", "COMMIT"].includes(mode)) return res.status(400).json({ success: false, error: "INVALID_MODE" });

    const tx = await db.query("SELECT * FROM settlement_queue WHERE transaction_id=$1 LIMIT 1", [id]);
    if (!tx.rows.length) return res.status(404).json({ success: false, error: "NOT_FOUND" });
    if (mode === "DRY_RUN") return res.json({ success: true, mode, replayed: false, status: tx.rows[0].status });

    if (mode === "SAFE" && tx.rows[0].status === "SETTLED") return res.json({ success: true, mode, replayed: false, status: "ALREADY_SETTLED" });

    const result = await settleTransaction(id);
    return res.json({ success: true, mode, replayed: true, result });
  } catch (error) { return next(error); }
}
