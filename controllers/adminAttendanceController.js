import pool from "../configs/db.js";

// ===== ADMIN FUNCTIONS =====

// 1️⃣ Initialize daily attendance at 00:00 (exclude admins)
export const initializeDailyAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sql = `
      INSERT INTO attendance (numerical_id, date, status)
      SELECT e.id, ?, 'pending'
      FROM employee e
      LEFT JOIN attendance a
        ON a.numerical_id = e.id AND a.date = ?
      WHERE a.numerical_id IS NULL
        AND e.role != 'admin'
    `;
    const [result] = await pool.query(sql, [today, today]);
    res.json({ message: "✅ Daily attendance initialized", inserted: result.affectedRows });
  } catch (err) {
    console.error("Error initializing attendance:", err.message);
    res.status(500).json({ message: "Error initializing attendance", error: err.message });
  }
};

// 2️⃣ Employee check-in
export const checkIn = async (req, res) => {
  try {
    const { employee_id, shift } = req.body;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0]; // HH:MM:SS

    let status = "absent";

    // Determine status based on shift and time
    if (shift === "day") {
      if (time >= "07:00:00" && time <= "08:00:00") status = "present";
      else if (time > "08:00:00" && time <= "09:00:00") status = "late";
      else status = "absent";
    } else if (shift === "night") {
      if (time >= "19:00:00" && time <= "20:00:00") status = "present";
      else if (time > "20:00:00" && time <= "21:00:00") status = "late";
      else status = "absent";
    }

    const sql = `
      INSERT INTO attendance (numerical_id, date, shift, check_in_time, status)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE check_in_time=?, status=?
    `;
    await pool.query(sql, [employee_id, today, shift, time, status, time, status]);

    res.json({ message: `✅ Checked in as ${status}`, check_in_time: time, status });
  } catch (err) {
    console.error("Check-in error:", err.message);
    res.status(500).json({ message: "Error during check-in", error: err.message });
  }
};

// 3️⃣ Employee check-out
export const checkOut = async (req, res) => {
  try {
    const { employee_id, shift } = req.body;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0];

    const sql = `
      UPDATE attendance
      SET check_out_time=?, status=CASE 
        WHEN status='present' AND check_out_time IS NULL THEN 'late'
        ELSE status
      END
      WHERE numerical_id=? AND date=? AND shift=?
    `;
    const [result] = await pool.query(sql, [time, employee_id, today, shift]);
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "No check-in found for today" });

    res.json({ message: "✅ Checked out", check_out_time: time });
  } catch (err) {
    console.error("Check-out error:", err.message);
    res.status(500).json({ message: "Error during check-out", error: err.message });
  }
};

// 4️⃣ Fetch attendance by date (exclude admins)
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const sql = `
      SELECT e.name AS employee_name, a.date, a.shift, a.check_in_time, a.check_out_time, a.status
      FROM employee e
      LEFT JOIN attendance a ON e.id = a.numerical_id AND a.date = ?
      WHERE e.role != 'admin'
      ORDER BY e.name ASC
    `;
    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching attendance:", err.message);
    res.status(500).json({ message: "Error fetching attendance", error: err.message });
  }
};

// 5️⃣ Get summary by date (exclude admins)
export const getAttendanceSummary = async (req, res) => {
  try {
    const { date } = req.params;
    const sql = `
      SELECT a.status, COUNT(*) AS count
      FROM attendance a
      JOIN employee e ON a.numerical_id = e.id
      WHERE a.date = ? AND e.role != 'admin'
      GROUP BY a.status
    `;
    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching summary:", err.message);
    res.status(500).json({ message: "Error fetching summary", error: err.message });
  }
};
