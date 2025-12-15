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

// PUT update a payment
router.put("/payments/:id", updatePayment);

// DELETE a payment
router.delete("/payments/:id", deletePayment);






export { router as eventPayRouter };
