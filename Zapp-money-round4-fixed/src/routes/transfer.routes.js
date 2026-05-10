import express from "express";
import { sendMoney } from "../controllers/transfer.controller.js";

const router = express.Router();

router.post("/send", sendMoney);

export default router;
