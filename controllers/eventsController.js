// controllers/eventController.js
import pool from "../configs/db.js"; // mysql2/promise pool

// ================================
// CREATE EVENT
// ================================
export const createEvent = async (req, res) => {
  try {
    const { event_type, person_name, start_date, end_date, amount, created_by } = req.body;

    if (!event_type || !person_name || !start_date || !end_date || !amount || !created_by) {
      return res.status(400).json({ status: false, message: "All fields are required" });
    }

    const sql = `
      INSERT INTO event (event_type, person_name, start_date, end_date, amount, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      event_type,
      person_name,
      start_date,
      end_date,
      parseInt(amount, 10),
      parseInt(created_by, 10),
    ]);

    return res.json({
      status: true,
      message: "Event created successfully",
      eventId: result.insertId,
    });
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};

// ================================
// GET ALL EVENTS
// ================================
export const getEvents = async (req, res) => {
  try {
    const sql = "SELECT * FROM event ORDER BY start_date DESC";
    const [results] = await pool.query(sql);
    return res.json(results);
  } catch (err) {
    console.error("❌ Error fetching events:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};

// ================================
// GET SINGLE EVENT BY ID
// ================================
export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM event WHERE id = ?";
    const [results] = await pool.query(sql, [id]);

    if (results.length === 0) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }

    return res.json(results[0]);
  } catch (err) {
    console.error("❌ Error fetching event:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};

// ================================
// DELETE EVENT
// ================================
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM event WHERE id = ?";
    const [result] = await pool.query(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }

    return res.json({ status: true, message: "Event deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting event:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};

// ================================
// GET PAYMENTS BY EVENT ID
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
    console.error("❌ Error fetching payments:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};

// ================================
// GET TOTAL EVENTS
// ================================
export const getTotalEvents = async (req, res) => {
  try {
    const sql = "SELECT COUNT(*) AS total FROM event";
    const [result] = await pool.query(sql);

    return res.json({ status: true, total: result[0].total });
  } catch (err) {
    console.error("❌ Error fetching total events:", err.message);
    return res.status(500).json({ status: false, message: "Database error" });
  }
};
