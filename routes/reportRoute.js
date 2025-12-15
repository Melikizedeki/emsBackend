import express from "express";
import {
  getPerformanceReport,
  getPayrollReport,
} from "../controllers/reportController.js";

const router = express.Router();

// Performance & Payroll Endpoints
router.get("/performance/kpi", getPerformanceReport);
router.get("/payroll", getPayrollReport);

export { router as reportRouter };
