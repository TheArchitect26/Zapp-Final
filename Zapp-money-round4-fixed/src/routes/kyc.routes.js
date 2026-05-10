import express from "express";
import { initiateKYC } from "../controllers/kyc.controller.js";

const router = express.Router();
router.post("/initiate", initiateKYC);
export default router;
