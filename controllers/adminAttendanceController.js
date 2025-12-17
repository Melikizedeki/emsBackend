// controllers/attendanceController.js
import pool from "../configs/db.js";
import cron from "node-cron";

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

// 2️⃣ Fetch attendance by date (exclude admins)
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const sql = `
      SELECT e.name AS employee_name, a.date, a.check_in_time, a.check_out_time, a.status
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

// 3️⃣ Get summary by date (exclude admins)
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

// ===== CRON TASKS =====

// 🕛 00:00 — Initialize daily attendance as 'pending' (exclude admins)
cron.schedule("0 0 * * *", async () => {
  try {
    const sql = `
      INSERT INTO attendance (numerical_id, date, status)
      SELECT e.id, CURDATE(), 'pending'
      FROM employee e
      LEFT JOIN attendance a ON a.numerical_id = e.id AND a.date = CURDATE()
      WHERE a.numerical_id IS NULL
        AND e.role != 'admin'
    `;
    await pool.query(sql);
  } catch (err) {
    console.error("[00:00] Daily attendance init failed:", err.message);
  }
});

// 🕖 19:00 — Update pending / late statuses (applies to all non-admins)
cron.schedule(
  "0 19 * * *",
  async () => {
    try {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      // 1️⃣ Pending → Absent
      const sqlAbsent = `
        UPDATE attendance a
        JOIN employee e ON a.numerical_id = e.id
        SET a.status='absent', a.check_in_time='09:00', a.check_out_time='18:00'
        WHERE a.date=? AND a.status='pending' AND e.role != 'admin'
      `;
      await pool.query(sqlAbsent, [today]);

      // 2️⃣ Checked-in but no checkout → Late
      const sqlLate = `
        UPDATE attendance a
        JOIN employee e ON a.numerical_id = e.id
        SET a.status='late', a.check_out_time='18:00'
        WHERE a.date=? AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
          AND a.status IN ('present', 'pending') AND e.role != 'admin'
      `;
      await pool.query(sqlLate, [today]);
    } catch (err) {
      console.error("[19:00] Attendance status update failed:", err.message);
    }
  },
  { timezone: "Africa/Dar_es_Salaam" }
);
