// controllers/eventPaymentController.js
import pool from "../configs/db.js";

// ================================
// Get all payments for a specific event
// ================================
export const getPaymentsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const sql = `
      SELECT 
        ep.id, 
        ep.event_id, 
        ep.employee_id, 
        ep.name, 
        ep.amount_paid,
        e.amount AS required_amount,
        CASE 
          WHEN ep.amount_paid >= e.amount THEN 'Paid'
          ELSE 'Unpaid'
        END AS status
      FROM event_payment ep
      JOIN event e ON ep.event_id = e.id
      WHERE ep.event_id = ?
    `;

    const [results] = await pool.query(sql, [eventId]);
    return res.json({ payments: results });
  } catch (err) {
    console.error("Error fetching payments:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
};

// ================================
// Add new payment
// ================================
export const addPayment = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { employee_id, amount_paid } = req.body;

    if (!employee_id || !amount_paid) {
      return res.status(400).json({ message: "Employee ID and amount are required" });
    }

    const [employeeResults] = await pool.query(
      "SELECT id AS employee_numeric_id, name FROM employee WHERE employee_id = ?",
      [employee_id]
    );

    if (employeeResults.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { employee_numeric_id, name } = employeeResults[0];

    const [result] = await pool.query(
      `INSERT INTO event_payment (event_id, employee_id, employee_numeric_id, name, amount_paid)
       VALUES (?, ?, ?, ?, ?)`,
      [eventId, employee_id, employee_numeric_id, name, amount_paid]
    );

    const newPayment = {
      id: result.insertId,
      event_id: eventId,
      employee_id,
      employee_numeric_id,
      name,
      amount_paid,
      status: amount_paid > 0 ? "Paid" : "Unpaid",
    };

    return res.status(201).json({ payment: newPayment });
  } catch (err) {
    console.error("Error adding payment:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
};

// ================================
// Update payment
// ================================
export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, amount_paid } = req.body;

    if (!employee_id || !amount_paid) {
      return res.status(400).json({ message: "Employee ID and amount are required" });
    }

    const [employeeResults] = await pool.query(
      "SELECT id AS employee_numeric_id, name FROM employee WHERE employee_id = ?",
      [employee_id]
    );

    if (employeeResults.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { employee_numeric_id, name } = employeeResults[0];

    await pool.query(
      `UPDATE event_payment 
       SET employee_id = ?, employee_numeric_id = ?, name = ?, amount_paid = ?
       WHERE id = ?`,
      [employee_id, employee_numeric_id, name, amount_paid, id]
    );

    return res.json({
      message: "Payment updated",
      payment: { id, employee_id, employee_numeric_id, name, amount_paid, status: amount_paid > 0 ? "Paid" : "Unpaid" },
    });
  } catch (err) {
    console.error("Error updating payment:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
};

// ================================
// Delete payment
// ================================
export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM event_payment WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.json({ message: "Payment deleted successfully" });
  } catch (err) {
    console.error("Error deleting payment:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
};

// ================================
// Get all events with payment status for a specific staff member
// ================================
export const getStaffEvents = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const sql = `
      SELECT 
        e.id AS event_id,
        e.person_name,
        e.event_type,
        e.start_date,
        e.end_date,
        e.amount AS total_amount,
        COALESCE(SUM(ep.amount_paid), 0) AS amount_paid,
        (e.amount - COALESCE(SUM(ep.amount_paid), 0)) AS remaining_amount,
        CASE 
          WHEN COALESCE(SUM(ep.amount_paid), 0) >= e.amount THEN 'Paid'
          ELSE 'Unpaid'
        END AS status
      FROM event e
      LEFT JOIN event_payment ep 
        ON e.id = ep.event_id 
        AND ep.employee_numeric_id = ?
      GROUP BY e.id, e.person_name, e.event_type, e.start_date, e.end_date, e.amount
      ORDER BY e.start_date DESC
    `;

    const [results] = await pool.query(sql, [employeeId]);
    return res.json({ success: true, events: results });
  } catch (err) {
    console.error("Error fetching staff events:", err.message);
    return res.status(500).json({ success: false, message: "Database error" });
  }
};
