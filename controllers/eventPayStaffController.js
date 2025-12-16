// controllers/staffEventsController.js
import pool from "../configs/db.js"; // mysql2/promise pool

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
        DATE(e.start_date) AS start_date,
        DATE(e.end_date) AS end_date,
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

    // ✅ Using mysql2/promise
    const [results] = await pool.query(sql, [employeeId]);

    return res.json({ success: true, events: results });
  } catch (err) {
    console.error("❌ Error fetching staff events:", err.message);
    return res.status(500).json({ success: false, message: "Database error" });
  }
};
