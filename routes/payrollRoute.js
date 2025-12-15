import express from "express";
import {
  getPayrollsByMonthAndSync,
  addDeduction,
  getDeductions,
getTotalGrossSalaryForMonth 
} from "../controllers/payrollController.js";

const router = express.Router();

// Fetch payrolls for month and auto-sync with employees table
router.get("/payrolls/:month", getPayrollsByMonthAndSync);

// Add deduction
router.post("/payrolls/:payrollId/deductions", addDeduction);

// List deductions
router.get("/payrolls/:payrollId/deductions", getDeductions);

router.get("/month/:month/total-gross", getTotalGrossSalaryForMonth);

export { router as payrollRouter };
