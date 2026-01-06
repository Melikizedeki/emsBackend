import express from "express";
import { getStaffEvents } from "../controllers/eventPayController.js";

const router = express.Router();

// GET all events for a specific employee
router.get("/:employeeId", getStaffEvents);

export { router as eventPayStaffRouter };
