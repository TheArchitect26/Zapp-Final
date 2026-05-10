import express from "express";
import { replayTransaction } from "../controllers/replay.controller.js";

const router = express.Router();
router.post("/transaction/:id", replayTransaction);

export default router;
