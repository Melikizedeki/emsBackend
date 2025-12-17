import cron from "node-cron";
import db from "./db.js";

// ===== 00:00 — Initialize daily attendance as 'pending' (exclude admins) =====
cron.schedule("0 0 * * *", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    INSERT INTO attendance (numerical_id, date, status, shift)
    SELECT id, ?, 'pending', shift
    FROM employee
    WHERE id NOT IN (
      SELECT numerical_id FROM attendance WHERE DATE(date) = ?
    ) AND role != 'admin'
  `;
  db.query(sql, [today, today], (err) => {
    if (err) console.error("[00:00] Initialize daily attendance failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== 18:00 — Auto-checkout day shifts =====
cron.schedule("0 18 * * 1-5", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance
    SET 
      check_out_time = '18:00:00',
      status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END,
      punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND shift = 'day' AND check_in_time IS NOT NULL AND check_out_time IS NULL
  `;
  db.query(sql, [today], (err) => {
    if (err) console.error("[18:00] Auto-checkout day shifts failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== 06:00 — Auto-checkout night shifts (previous day) =====
cron.schedule("0 6 * * *", () => {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];
  const sql = `
    UPDATE attendance
    SET 
      check_out_time = '07:00:00',
      status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END,
      punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND shift = 'night' AND check_in_time IS NOT NULL AND check_out_time IS NULL
  `;
  db.query(sql, [yesterday], (err) => {
    if (err) console.error("[06:00] Auto-checkout night shifts failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== Saturday auto-checkout for day shifts =====
cron.schedule("0 15 * * 6", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance
    SET 
      check_out_time = '15:00:00',
      status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END,
      punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND shift = 'day' AND check_in_time IS NOT NULL AND check_out_time IS NULL
  `;
  db.query(sql, [today], (err) => {
    if (err) console.error("[Saturday 15:00] Auto-checkout failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== 08:00 — Finalize previous day attendance in DB =====
cron.schedule("0 8 * * *", () => {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];

  // Pending → Absent (auto-fill times)
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
  db.query(sqlAbsent, [yesterday], (err) => {
    if (err) console.error("[08:00] Pending → Absent failed:", err);
  });

  // Checked-in but no checkout → Late (auto-fill checkout)
  const sqlLate = `
    UPDATE attendance a
    JOIN employee e ON a.numerical_id = e.id
    SET 
      a.status = 'late',
      a.check_out_time = CASE WHEN a.shift='day' THEN '18:00:00' ELSE '07:00:00' END
    WHERE a.date = ? AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
      AND a.status IN ('present', 'pending')
      AND e.role != 'admin'
  `;
  db.query(sqlLate, [yesterday], (err) => {
    if (err) console.error("[08:00] Auto late checkout failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });
