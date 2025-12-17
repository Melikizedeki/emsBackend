import pool from "../configs/db.js";
import cron from "node-cron";

// ===== ADMIN FUNCTIONS =====

// 1️⃣ Initialize daily attendance at 00:00 (exclude admins)
export const initializeDailyAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sql = `
      INSERT INTO attendance (numerical_id, date, status, shift)
      SELECT id, ?, 'pending', shift
      FROM employee
      WHERE id NOT IN (
        SELECT numerical_id FROM attendance WHERE DATE(date) = ?
      ) AND role != 'admin'
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
      SELECT e.name AS employee_name, a.date, a.check_in_time, a.check_out_time, a.status, a.shift
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

// 🕛 00:00 — Initialize daily attendance (exclude admins)
cron.schedule("0 0 * * *", async () => {
  try {
    const sql = `
      INSERT INTO attendance (numerical_id, date, status, shift)
      SELECT id, CURDATE(), 'pending', shift
      FROM employee
      WHERE id NOT IN (
        SELECT numerical_id FROM attendance WHERE DATE(date) = CURDATE()
      ) AND role != 'admin'
    `;
    await pool.query(sql);
  } catch (err) {
    console.error("[00:00] Daily attendance init failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });

// 🕗 08:00 — Finalize previous day attendance
cron.schedule("0 8 * * *", async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];

    // Pending → Absent with auto times
    const sqlAbsent = `
      UPDATE attendance a
      JOIN employee e ON a.numerical_id = e.id
      SET 
        a.status = 'absent',
        a.check_in_time = CASE WHEN a.shift='day' THEN '09:01:00' ELSE '21:01:00' END,
        a.check_out_time = CASE WHEN a.shift='day' THEN '18:00:00' ELSE '07:00:00' END
      WHERE a.date = ? AND (a.status='pending' OR a.status IS NULL)
        AND e.role != 'admin'
    `;
    await pool.query(sqlAbsent, [yesterday]);

    // Checked-in but no checkout → Late with auto checkout
    const sqlLate = `
      UPDATE attendance a
      JOIN employee e ON a.numerical_id = e.id
      SET 
        a.status = 'late',
        a.check_out_time = CASE WHEN a.shift='day' THEN '18:00:00' ELSE '07:00:00' END
      WHERE a.date = ? AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
        AND a.status IN ('present', 'pending') AND e.role != 'admin'
    `;
    await pool.query(sqlLate, [yesterday]);

  } catch (err) {
    console.error("[08:00] Finalizing previous day attendance failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });

// 🕖 18:00 — Auto-checkout day shifts Mon-Fri
cron.schedule("0 18 * * 1-5", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sql = `
      UPDATE attendance
      SET 
        check_out_time = '18:00:00',
        status = CASE WHEN LOWER(status)='present' THEN 'late' ELSE status END
      WHERE date=? AND shift='day' AND check_in_time IS NOT NULL AND check_out_time IS NULL
    `;
    await pool.query(sql, [today]);
  } catch (err) {
    console.error("[18:00] Day shift auto-checkout failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });

// 🕕 06:00 — Auto-checkout night shifts (previous day)
cron.schedule("0 6 * * *", async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split("T")[0];
    const sql = `
      UPDATE attendance
      SET 
        check_out_time = '07:00:00',
        status = CASE WHEN LOWER(status)='present' THEN 'late' ELSE status END
      WHERE date=? AND shift='night' AND check_in_time IS NOT NULL AND check_out_time IS NULL
    `;
    await pool.query(sql, [yesterday]);
  } catch (err) {
    console.error("[06:00] Night shift auto-checkout failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });

// 🕒 15:00 — Saturday day shift checkout
cron.schedule("0 15 * * 6", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const sql = `
      UPDATE attendance
      SET 
        check_out_time = '15:00:00',
        status = CASE WHEN LOWER(status)='present' THEN 'late' ELSE status END
      WHERE date=? AND shift='day' AND check_in_time IS NOT NULL AND check_out_time IS NULL
    `;
    await pool.query(sql, [today]);
  } catch (err) {
    console.error("[Saturday 15:00] Day shift checkout failed:", err.message);
  }
}, { timezone: "Africa/Dar_es_Salaam" });
