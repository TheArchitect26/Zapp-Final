import express from "express";
import { getSystemState } from "../controllers/system.controller.js";

const router = express.Router();
router.get("/state", getSystemState);

export default router;
