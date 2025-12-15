import db from "../configs/db.js";

// ✅ Get all payments for a specific event
export const getPaymentsByEvent = (req, res) => {
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

  db.query(sql, [eventId], (err, results) => {
    if (err) {
      console.error("Error fetching payments:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ payments: results });
  });
};

// ✅ Add new payment (auto fetch name and numeric ID)
export const addPayment = (req, res) => {
  const { eventId } = req.params;
  const { employee_id, amount_paid } = req.body; // frontend sends only these

  if (!employee_id || !amount_paid) {
    return res.status(400).json({ message: "Employee ID and amount are required" });
  }

  // Fetch employee details
  const employeeSql = `
    SELECT id AS employee_numeric_id, name 
    FROM employee 
    WHERE employee_id = ?
  `;

  db.query(employeeSql, [employee_id], (err, employeeResults) => {
    if (err) {
      console.error("Error fetching employee:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (employeeResults.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { employee_numeric_id, name } = employeeResults[0];

    // Insert into event_payment
    const insertSql = `
      INSERT INTO event_payment (event_id, employee_id, employee_numeric_id, name, amount_paid)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(insertSql, [eventId, employee_id, employee_numeric_id, name, amount_paid], (err, result) => {
      if (err) {
        console.error("Error inserting payment:", err);
        return res.status(500).json({ message: "Database error" });
      }

      const newPayment = {
        id: result.insertId,
        event_id: eventId,
        employee_id,
        employee_numeric_id,
        name,
        amount_paid,
        status: amount_paid > 0 ? "Paid" : "Unpaid",
      };

      res.status(201).json({ payment: newPayment });
    });
  });
};

// ✅ Update payment (auto fetch name if employee_id changes)
export const updatePayment = (req, res) => {
  const { id } = req.params;
  const { employee_id, amount_paid } = req.body;

  if (!employee_id || !amount_paid) {
    return res.status(400).json({ message: "Employee ID and amount are required" });
  }

  // Fetch employee name & numeric ID
  const employeeSql = `SELECT id AS employee_numeric_id, name FROM employee WHERE employee_id = ?`;

  db.query(employeeSql, [employee_id], (err, employeeResults) => {
    if (err) {
      console.error("Error fetching employee:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (employeeResults.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { employee_numeric_id, name } = employeeResults[0];

    // Update payment
    const updateSql = `
      UPDATE event_payment 
      SET employee_id = ?, employee_numeric_id = ?, name = ?, amount_paid = ?
      WHERE id = ?
    `;

    db.query(updateSql, [employee_id, employee_numeric_id, name, amount_paid, id], (err) => {
      if (err) {
        console.error("Error updating payment:", err);
        return res.status(500).json({ message: "Database error" });
      }

      res.json({
        message: "Payment updated",
        payment: { id, employee_id, employee_numeric_id, name, amount_paid, status: amount_paid > 0 ? "Paid" : "Unpaid" },
      });
    });
  });
};

// ✅ Delete a payment
export const deletePayment = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM event_payment WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error deleting payment:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Payment deleted successfully" });
  });
};

// ✅ Get all events with payment status for a specific staff member
export const getStaffEvents = (req, res) => {
  const { employeeId } = req.params; // numeric employee ID

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

  db.query(sql, [employeeId], (err, results) => {
    if (err) {
      console.error("Error fetching staff events:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    return res.json({ success: true, events: results });
  });
};
