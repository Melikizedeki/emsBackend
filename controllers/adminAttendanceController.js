// controllers/attendanceController.js
import pool from "../configs/db.js";

// ======================================================
// 🧠 HELPERS
// ======================================================
const getTodayDate = () =>
  new Date().toISOString().split("T")[0];

const getYesterdayDate = () =>
  new Date(Date.now() - 86400000).toISOString().split("T")[0];

const getCurrentTime = () =>
  new Date().toTimeString().slice(0, 8);

// ======================================================
// 1️⃣ INITIALIZE DAILY ATTENDANCE (EXCLUDE ADMINS)
// ======================================================
export const initializeDailyAttendance = async (req, res) => {
  try {
    const today = getTodayDate();

    const sql = `
      INSERT INTO attendance (numerical_id, date, status)
      SELECT e.id, ?, 'pending'
      FROM employee e
      WHERE e.role <> 'admin'
        AND e.id NOT IN (
          SELECT numerical_id FROM attendance WHERE date = ?
        )
    `;

    const [result] = await pool.query(sql, [today, today]);

    res.json({
      message: "✅ Daily attendance initialized (admins excluded)",
      inserted: result.affectedRows
    });
  } catch (err) {
    console.error("Initialize error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

{/*
// ======================================================
// 2️⃣ CHECK-IN (ADMINS BLOCKED)
// ======================================================
export const checkIn = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const time = getCurrentTime();
    const date = getTodayDate();

    // 🔒 Block admin
    const [emp] = await pool.query(
      `SELECT role FROM employee WHERE id = ?`,
      [employee_id]
    );

    if (!emp.length || emp[0].role === "admin") {
      return res.status(403).json({
        message: "❌ Admins are not allowed to check in"
      });
    }

    let status = null;

    // Day shift
    if (time >= "07:30:00" && time <= "08:00:00") status = "present";
    else if (time >= "08:01:00" && time <= "09:00:00") status = "late";

    // Night shift
    else if (time >= "19:30:00" && time <= "20:00:00") status = "present";
    else if (time >= "20:01:00" && time <= "21:00:00") status = "late";

    if (!status) {
      return res.status(403).json({
        message: "❌ Check-in not allowed at this time"
      });
    }

    // Prevent double check-in
    const [existing] = await pool.query(
      `SELECT check_in_time FROM attendance
       WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL`,
      [employee_id, date]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "❌ Check-in already recorded"
      });
    }

    await pool.query(
      `UPDATE attendance
       SET check_in_time=?, status=?
       WHERE numerical_id=? AND date=?`,
      [time, status, employee_id, date]
    );

    res.json({
      message: "✅ Check-in successful",
      status
    });
  } catch (err) {
    console.error("Check-in error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ======================================================
// 3️⃣ CHECK-OUT (ADMINS BLOCKED)
// ======================================================
export const checkOut = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const time = getCurrentTime();

    const [emp] = await pool.query(
      `SELECT role FROM employee WHERE id = ?`,
      [employee_id]
    );

    if (!emp.length || emp[0].role === "admin") {
      return res.status(403).json({
        message: "❌ Admins are not allowed to check out"
      });
    }

    let date = getTodayDate();

    if (time >= "06:00:00" && time <= "07:55:00") {
      date = getYesterdayDate();
    }

    const [result] = await pool.query(
      `UPDATE attendance
       SET check_out_time=?
       WHERE numerical_id=? AND date=?
         AND check_in_time IS NOT NULL
         AND check_out_time IS NULL`,
      [time, employee_id, date]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "❌ No active check-in found"
      });
    }

    res.json({ message: "✅ Check-out successful" });
  } catch (err) {
    console.error("Check-out error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

*/}

// ======================================================
// 4️⃣ FETCH ATTENDANCE BY DATE (ADMINS EXCLUDED)
// ======================================================
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const sql = `
      SELECT 
        e.id AS employee_id,
        e.name AS employee_name,
        e.role,
        a.date,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.status, 'absent') AS status
      FROM employee e
      LEFT JOIN attendance a
        ON e.id = a.numerical_id AND a.date = ?
      WHERE e.role <> 'admin'
      ORDER BY e.name ASC
    `;

    const [rows] = await pool.query(sql, [date]);
    res.json(rows);
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ======================================================
// 5️⃣ ATTENDANCE SUMMARY (CARD COUNTS – ALWAYS CORRECT)
// ======================================================
export const getAttendanceSummary = async (req, res) => {
  try {
    const { date } = req.params;

    const sql = `
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent
      FROM employee e
      LEFT JOIN attendance a
        ON e.id = a.numerical_id AND a.date = ?
      WHERE e.role <> 'admin'
    `;

    const [[summary]] = await pool.query(sql, [date]);

    res.json(summary);
  } catch (err) {
    console.error("Summary error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
