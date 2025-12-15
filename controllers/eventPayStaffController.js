import db from "../configs/db.js"; // make sure your db connection is correct

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
    DATE(e.start_date) AS start_date,  -- only date
    DATE(e.end_date) AS end_date,      -- only date
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
    AND ep.employee_numeric_id = ?   -- numeric ID column
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


