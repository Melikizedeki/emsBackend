import express from "express";
import {
  getPaymentsByEvent,
  addPayment,
  deletePayment,
  updatePayment,
} from "../controllers/eventPayController.js";

const router = express.Router();

// GET all payments for an event
router.get("/:eventId/payments", getPaymentsByEvent);

// POST new payment for an event
router.post("/:eventId/payments", addPayment);

// PUT update a payment by payment ID
router.put("/payments/:paymentId", updatePayment);

// DELETE a payment by payment ID
router.delete("/payments/:paymentId", deletePayment);

export { router as eventPayRouter };
