import pool from "../configs/db.js";
import cron from "node-cron";

// ===== ADMIN FUNCTIONS =====

// 1️⃣ Initialize daily attendance at 00:00
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
    `;

    const [result] = await pool.query(sql, [today, today]);
    res.json({ message: "✅ Daily attendance initialized", inserted: result.affectedRows });
  } catch (err) {
    console.error("Error initializing attendance:", err.message);
    res.status(500).json({ message: "Error initializing attendance", error: err.message });
  }
};

// 2️⃣ Fetch attendance by date
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const sql = `
      SELECT e.name AS employee_name, a.date, a.check_in_time, a.check_out_time, a.status
      FROM employee e
      LEFT JOIN attendance a ON e.id = a.numerical_id AND a.date = ?
      ORDER BY e.name ASC
    `;

    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching attendance:", err.message);
    res.status(500).json({ message: "Error fetching attendance", error: err.message });
  }
};

// 3️⃣ Get summary by date
export const getAttendanceSummary = async (req, res) => {
  try {
    const { date } = req.params;

    const sql = `
      SELECT status, COUNT(*) AS count
      FROM attendance
      WHERE date = ?
      GROUP BY status
    `;

    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching summary:", err.message);
    res.status(500).json({ message: "Error fetching summary", error: err.message });
  }
};

// ===== CRON TASKS =====

// 🕛 00:00 — Initialize daily attendance as 'pending'
cron.schedule("0 0 * * *", async () => {
  try {
    const sql = `
      INSERT INTO attendance (numerical_id, date, status)
      SELECT e.id, CURDATE(), 'pending'
      FROM employee e
      LEFT JOIN attendance a ON a.numerical_id = e.id AND a.date = CURDATE()
      WHERE a.numerical_id IS NULL
    `;
    await pool.query(sql);
    // success log removed for production
  } catch (err) {
    console.error("[00:00] Daily attendance init failed:", err.message);
  }
});

// 🕖 19:00 — Update pending / late statuses
cron.schedule("0 19 * * *", async () => {
  try {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

    // 1️⃣ Pending → Absent
    const sqlAbsent = `
      UPDATE attendance
      SET status='absent', check_in_time='09:00', check_out_time='18:00'
      WHERE date=? AND status='pending'
    `;
    await pool.query(sqlAbsent, [today]);

    // 2️⃣ Checked-in but no checkout → Late
    const sqlLate = `
      UPDATE attendance
      SET status='late', check_out_time='18:00'
      WHERE date=? AND check_in_time IS NOT NULL AND check_out_time IS NULL AND status IN ('present', 'pending')
    `;
    await pool.query(sqlLate, [today]);

    // success log removed for production
  } catch (err) {
    console.error("[19:00] Attendance status update failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });
