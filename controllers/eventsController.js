import db from "../configs/db.js"; // your MySQL connection

// CREATE EVENT
export const createEvent = (req, res) => {
  const { event_type, person_name, start_date, end_date, amount, created_by } = req.body;

  if (!event_type || !person_name || !start_date || !end_date || !amount || !created_by) {
    return res.status(400).json({ status: false, message: "All fields are required" });
  }

  const sql = `
    INSERT INTO event (event_type, person_name, start_date, end_date, amount, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [event_type, person_name, start_date, end_date, parseInt(amount, 10), parseInt(created_by, 10)],
    (err, result) => {
      if (err) {
        console.error("DB Error:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      return res.json({
        status: true,
        message: "Event created successfully",
        eventId: result.insertId, // ✅ return the event ID
      });
    }
  );
};

// GET ALL EVENTS
export const getEvents = (req, res) => {
  const sql = "SELECT * FROM event ORDER BY start_date DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    return res.json(results);
  });
};

// GET SINGLE EVENT BY ID
export const getEventById = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM event WHERE id = ?";
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (results.length === 0)
      return res.status(404).json({ status: false, message: "Event not found" });
    return res.json(results[0]);
  });
};

// DELETE EVENT
export const deleteEvent = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM event WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ status: false, message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ status: false, message: "Event not found" });
    return res.json({ status: true, message: "Event deleted successfully" });
  });
};

// ✅ GET PAYMENTS BY EVENT ID
// ✅ GET PAYMENTS BY EVENT ID
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
      return res.status(500).json({ status: false, message: "Database error" });
    }
    return res.json({ payments: results });
  });
};


export const getTotalEventss = (req, res) => {
  const sql = "SELECT COUNT(*) AS total FROM event";

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching total events:", err.sqlMessage);
      return res.json({ Status: false, Error: err.sqlMessage });
    }

    
    return res.json({ Status: true, total: result[0].total });
  });
};


