import express from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  createCustomer,
  listCustomers,
  getCustomer,
  deleteCustomer,
} from "../controllers/customers.controller.js";

const router = express.Router();

router.post("/create", requireAdmin, createCustomer);
router.get("/list", requireAdmin, listCustomers);
router.get("/:id", requireAdmin, getCustomer);
router.delete("/:id", requireAdmin, deleteCustomer);

export default router;
