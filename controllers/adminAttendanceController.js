import db from "../configs/db.js";
import cron from "node-cron";

// ===== ADMIN FUNCTIONS =====

// 1️⃣ Initialize daily attendance at 00:00
export const initializeDailyAttendance = (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    INSERT INTO attendance (numerical_id, date, status)
    SELECT e.id, ?, 'pending'
    FROM employee e
    LEFT JOIN attendance a
      ON a.numerical_id = e.id AND a.date = ?
    WHERE a.numerical_id IS NULL
  `;
  db.query(sql, [today, today], (err, result) => {
    if (err) return res.status(500).json({ message: "Error initializing attendance", error: err });
    res.json({ message: "✅ Daily attendance initialized", inserted: result.affectedRows });
  });
};

// 2️⃣ Fetch attendance by date
export const getAttendanceByDate = (req, res) => {
  const { date } = req.params;
  const sql = `
    SELECT e.name AS employee_name, a.date, a.check_in_time, a.check_out_time, a.status
    FROM employee e
    LEFT JOIN attendance a ON e.id = a.numerical_id AND a.date = ?
    ORDER BY e.name ASC
  `;
  db.query(sql, [date], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching attendance", error: err });
    res.json(rows);
  });
};

// 3️⃣ Get summary by date
export const getAttendanceSummary = (req, res) => {
  const { date } = req.params;
  const sql = `
    SELECT status, COUNT(*) AS count
    FROM attendance
    WHERE date = ?
    GROUP BY status
  `;
  db.query(sql, [date], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching summary", error: err });
    res.json(rows);
  });
};

// ===== CRON TASKS =====

// 🕛 00:00 — Initialize daily attendance as 'pending'
cron.schedule("0 0 * * *", () => {
  const sql = `
    INSERT INTO attendance (numerical_id, date, status)
    SELECT e.id, CURDATE(), 'pending'
    FROM employee e
    LEFT JOIN attendance a ON a.numerical_id = e.id AND a.date = CURDATE()
    WHERE a.numerical_id IS NULL
  `;
  db.query(sql, (err) => {
    if (err) console.error('[00:00] Daily attendance init failed', err);
    // success log removed for production
  });
});

cron.schedule("0 19 * * *", () => {
  const today = new Date().toLocaleDateString("en-CA"); // Local date (YYYY-MM-DD)

  // 1️⃣ Pending → Absent
  const sqlAbsent = `
    UPDATE attendance
    SET status='absent', check_in_time='09:00', check_out_time='18:00'
    WHERE date=? AND status='pending'
  `;
  db.query(sqlAbsent, [today], (err, res1) => {
    if (err) console.error("❌ Pending → absent failed:", err);
    // success log removed for production
  });

  // 2️⃣ Checked-in but no checkout → Late
  const sqlLate = `
    UPDATE attendance
    SET status='late', check_out_time='18:00'
    WHERE date=? AND check_in_time IS NOT NULL AND check_out_time IS NULL AND status IN ('present', 'pending')
  `;
  db.query(sqlLate, [today], (err, res2) => {
    if (err) console.error("❌ Late update failed:", err);
    // success log removed for production
  });
}, { timezone: "Africa/Dar_es_Salaam" });

  
