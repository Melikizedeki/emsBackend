import db from "../configs/db.js";
import { promisify } from "util";

const query = promisify(db.query).bind(db); // wrap db.query to use async/await

// Auto-sync payroll with employee table for the month
export const getPayrollsByMonthAndSync = async (req, res) => {
  try {
    const month = req.params.month;

    // 1. Get all active employees
    const employees = await query("SELECT id, name, salary FROM employee WHERE status='active'");

    // 2. Loop through employees to ensure payroll exists & up-to-date
    for (const emp of employees) {
      const existing = await query(
        "SELECT id, salary FROM payrolls WHERE numerical_id=? AND month=?",
        [emp.id, month]
      );

      if (existing.length === 0) {
        // Insert new payroll
        await query(
          "INSERT INTO payrolls (numerical_id, month, salary, total_deduction, net_salary) VALUES (?, ?, ?, 0, ?)",
          [emp.id, month, emp.salary, emp.salary]
        );
      } else {
        // Update salary if changed
        if (existing[0].salary !== emp.salary) {
          const deductionResult = await query(
            "SELECT SUM(amount) AS totalDeduction FROM payroll_deductions WHERE payroll_id=?",
            [existing[0].id]
          );
          const netSalary = emp.salary - (deductionResult[0].totalDeduction || 0);
          await query(
            "UPDATE payrolls SET salary=?, net_salary=? WHERE id=?",
            [emp.salary, netSalary, existing[0].id]
          );
        }
      }
    }

    // 3. Fetch payrolls for month
    const payrolls = await query(
      `SELECT p.id, e.name, p.salary, p.total_deduction, p.net_salary 
       FROM payrolls p 
       JOIN employee e ON p.numerical_id = e.id
       WHERE p.month=?`,
      [month]
    );

    // 4. Calculate totals
    const totalsResult = await query(
      `SELECT SUM(salary) AS totalSalary, SUM(total_deduction) AS totalDeduction, SUM(net_salary) AS netSalary
       FROM payrolls WHERE month=?`,
      [month]
    );

    res.json({ payrolls, totals: totalsResult[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add deduction
export const addDeduction = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { reason, amount } = req.body;

    await query(
      "INSERT INTO payroll_deductions (payroll_id, reason, amount) VALUES (?, ?, ?)",
      [payrollId, reason, amount]
    );

    // Update payroll totals
    const payroll = await query("SELECT salary FROM payrolls WHERE id=?", [payrollId]);
    const deductions = await query(
      "SELECT SUM(amount) AS totalDeduction FROM payroll_deductions WHERE payroll_id=?",
      [payrollId]
    );

    const net = payroll[0].salary - (deductions[0].totalDeduction || 0);

    await query(
      "UPDATE payrolls SET total_deduction=?, net_salary=? WHERE id=?",
      [deductions[0].totalDeduction || 0, net, payrollId]
    );

    res.json({ message: "Deduction added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get deductions
export const getDeductions = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const deductions = await query(
      "SELECT * FROM payroll_deductions WHERE payroll_id=?",
      [payrollId]
    );
    res.json(deductions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getTotalGrossSalaryForMonth = async (req, res) => {
  try {
    const { month } = req.params; // month number 1-12

    // 1️⃣ Get all active employees
    const employees = await query(
      "SELECT id, name, salary FROM employee WHERE status='active'"
    );

    // 2️⃣ Ensure payroll exists for each employee for the given month
    for (const emp of employees) {
      const existing = await query(
        "SELECT id FROM payrolls WHERE numerical_id=? AND month=?",
        [emp.id, month]
      );

      if (existing.length === 0) {
        // Insert payroll with net_salary = salary (no deductions yet)
        await query(
          "INSERT INTO payrolls (numerical_id, month, salary, total_deduction, net_salary) VALUES (?, ?, ?, 0, ?)",
          [emp.id, month, emp.salary, emp.salary] // fixed: net_salary = salary
        );
      } else {
        // Optional: Update payroll salary if employee salary has changed
        await query(
          "UPDATE payrolls SET salary=?, net_salary=? WHERE numerical_id=? AND month=?",
          [emp.salary, emp.salary, emp.id, month]
        );
      }
    }

    // 3️⃣ Calculate total gross salary dynamically
    const totalsResult = await query(
      "SELECT SUM(salary) AS totalGrossSalary FROM payrolls WHERE month=?",
      [month]
    );

    res.json({
      month,
      totalGrossSalary: totalsResult[0].totalGrossSalary || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
