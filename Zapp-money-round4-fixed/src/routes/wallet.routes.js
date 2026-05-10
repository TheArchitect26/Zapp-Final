import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const router = express.Router();

/**
 * GET /api/v1/wallet/:userId
 * Returns the wallet balance from the authoritative Supabase wallets table.
 * Users may only query their own wallet unless they are admins.
 */
router.get("/:userId", async (req, res, next) => {
  try {
    const requestedUserId = req.params.userId;
    const callerUserId = req.user?.id;

    // Only allow users to see their own wallet (admins bypass via has_role)
    if (requestedUserId !== callerUserId) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: callerUserId,
        _role: "admin",
      });
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: "FORBIDDEN" });
      }
    }

    const { data: wallet, error } = await supabaseAdmin
      .from("wallets")
      .select("id, user_id, balance, updated_at")
      .eq("user_id", requestedUserId)
      .single();

    if (error || !wallet) {
      return res.status(404).json({ success: false, error: "WALLET_NOT_FOUND" });
    }

    return res.json({
      success: true,
      wallet: {
        userId: wallet.user_id,
        balance: Number(wallet.balance),
        currency: "ZAR",
        updatedAt: wallet.updated_at,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
