import express from "express";
import { requestWithdrawal } from "../controllers/withdraw.controller.js";

const router = express.Router();
router.post("/request", requestWithdrawal);
export default router;
