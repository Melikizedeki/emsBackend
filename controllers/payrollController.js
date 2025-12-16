// controllers/payrollController.js
import pool from "../configs/db.js"; // mysql2/promise pool

// ================================
// Get payrolls by month and auto-sync with employee table
// ================================
export const getPayrollsByMonthAndSync = async (req, res) => {
  try {
    const { month } = req.params;

    // 1️⃣ Get all active employees
    const [employees] = await pool.query(
      "SELECT id, name, salary FROM employee WHERE status='active'"
    );

    // 2️⃣ Ensure payroll exists & up-to-date
    for (const emp of employees) {
      const [existing] = await pool.query(
        "SELECT id, salary FROM payrolls WHERE numerical_id=? AND month=?",
        [emp.id, month]
      );

      if (existing.length === 0) {
        await pool.query(
          "INSERT INTO payrolls (numerical_id, month, salary, total_deduction, net_salary) VALUES (?, ?, ?, 0, ?)",
          [emp.id, month, emp.salary, emp.salary]
        );
      } else if (existing[0].salary !== emp.salary) {
        const [deductions] = await pool.query(
          "SELECT SUM(amount) AS totalDeduction FROM payroll_deductions WHERE payroll_id=?",
          [existing[0].id]
        );
        const netSalary = emp.salary - (deductions[0].totalDeduction || 0);

        await pool.query(
          "UPDATE payrolls SET salary=?, net_salary=? WHERE id=?",
          [emp.salary, netSalary, existing[0].id]
        );
      }
    }

    // 3️⃣ Fetch payrolls for the month
    const [payrolls] = await pool.query(
      `SELECT p.id, e.name, p.salary, p.total_deduction, p.net_salary 
       FROM payrolls p 
       JOIN employee e ON p.numerical_id = e.id
       WHERE p.month=?`,
      [month]
    );

    // 4️⃣ Calculate totals
    const [totalsResult] = await pool.query(
      `SELECT SUM(salary) AS totalSalary, SUM(total_deduction) AS totalDeduction, SUM(net_salary) AS netSalary
       FROM payrolls WHERE month=?`,
      [month]
    );

    res.json({ payrolls, totals: totalsResult[0] });
  } catch (err) {
    console.error("❌ Error fetching payrolls:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================
// Add deduction
// ================================
export const addDeduction = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { reason, amount } = req.body;

    await pool.query(
      "INSERT INTO payroll_deductions (payroll_id, reason, amount) VALUES (?, ?, ?)",
      [payrollId, reason, amount]
    );

    const [[payroll]] = await pool.query(
      "SELECT salary FROM payrolls WHERE id=?",
      [payrollId]
    );

    const [deductions] = await pool.query(
      "SELECT SUM(amount) AS totalDeduction FROM payroll_deductions WHERE payroll_id=?",
      [payrollId]
    );

    const net = payroll.salary - (deductions[0].totalDeduction || 0);

    await pool.query(
      "UPDATE payrolls SET total_deduction=?, net_salary=? WHERE id=?",
      [deductions[0].totalDeduction || 0, net, payrollId]
    );

    res.json({ message: "Deduction added successfully" });
  } catch (err) {
    console.error("❌ Error adding deduction:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================
// Get deductions for payroll
// ================================
export const getDeductions = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const [deductions] = await pool.query(
      "SELECT * FROM payroll_deductions WHERE payroll_id=?",
      [payrollId]
    );
    res.json(deductions);
  } catch (err) {
    console.error("❌ Error fetching deductions:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ================================
// Get total gross salary for a month
// ================================
export const getTotalGrossSalaryForMonth = async (req, res) => {
  try {
    const { month } = req.params;

    const [employees] = await pool.query(
      "SELECT id, salary FROM employee WHERE status='active'"
    );

    for (const emp of employees) {
      const [existing] = await pool.query(
        "SELECT id FROM payrolls WHERE numerical_id=? AND month=?",
        [emp.id, month]
      );

      if (existing.length === 0) {
        await pool.query(
          "INSERT INTO payrolls (numerical_id, month, salary, total_deduction, net_salary) VALUES (?, ?, ?, 0, ?)",
          [emp.id, month, emp.salary, emp.salary]
        );
      } else {
        await pool.query(
          "UPDATE payrolls SET salary=?, net_salary=? WHERE numerical_id=? AND month=?",
          [emp.salary, emp.salary, emp.id, month]
        );
      }
    }

    const [totalsResult] = await pool.query(
      "SELECT SUM(salary) AS totalGrossSalary FROM payrolls WHERE month=?",
      [month]
    );

    res.json({
      month,
      totalGrossSalary: totalsResult[0].totalGrossSalary || 0,
    });
  } catch (err) {
    console.error("❌ Error calculating gross salary:", err.message);
    res.status(500).json({ error: err.message });
  }
};
