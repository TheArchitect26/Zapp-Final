import express from "express";
import { createCheckout } from "../controllers/topup.controller.js";

const router = express.Router();
router.post("/checkout", createCheckout);
export default router;
