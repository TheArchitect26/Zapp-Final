import express from "express";
import { charge } from "../controllers/payments.controller.js";
import { paystackInitialize, paystackVerify } from "../controllers/paystack.controller.js";

const router = express.Router();

// Internal charge (wallet-to-wallet via MoneyEngine)
router.post("/charge", charge);

// Paystack deposit flow
router.post("/paystack/initialize", paystackInitialize);
router.get("/paystack/verify/:reference", paystackVerify);

export default router;
