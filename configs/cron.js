import cron from "node-cron";
import db from "./db.js";

// ===== 00:00 — Initialize daily attendance (staff only) =====
cron.schedule("0 0 * * *", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    INSERT INTO attendance (numerical_id, date, status)
    SELECT id, ?, 'pending'
    FROM employee
    WHERE role = 'staff' 
      AND id NOT IN (
        SELECT numerical_id FROM attendance WHERE DATE(date) = ?
      )
  `;
  db.query(sql, [today, today], (err) => {
    if (err) console.error("[00:00] Initialize daily attendance failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== 08:00 — Finalize previous day attendance (auto-fill status & checkout) =====
cron.schedule("0 8 * * *", () => {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
    .toISOString()
    .split("T")[0];

  // Pending → Absent with dynamic shift based times
  const sqlAbsent = `
    UPDATE attendance a
    JOIN employee e ON a.numerical_id = e.id
    SET 
      a.status = 'absent',
      a.check_in_time = CASE 
                          WHEN TIME(a.check_in_time) IS NOT NULL THEN a.check_in_time
                          WHEN HOUR(CURTIME()) < 12 THEN '09:01:00' 
                          ELSE '21:01:00' 
                        END,
      a.check_out_time = CASE 
                           WHEN HOUR(CURTIME()) < 12 THEN '18:00:00' 
                           ELSE '07:00:00' 
                         END
    WHERE a.date = ? AND (a.status='pending' OR a.status IS NULL)
      AND e.role = 'staff'
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
      a.check_out_time = CASE 
                           WHEN TIME(a.check_out_time) IS NULL AND HOUR(a.check_in_time) < 12 THEN '18:00:00'
                           ELSE '07:00:00'
                         END
    WHERE a.date = ? AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
      AND a.status IN ('present', 'pending')
      AND e.role = 'staff'
  `;
  db.query(sqlLate, [yesterday], (err) => {
    if (err) console.error("[08:00] Auto late checkout failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== 18:00 — Auto-checkout day shifts (Mon-Fri) =====
cron.schedule("0 18 * * 1-5", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance a
    JOIN employee e ON a.numerical_id = e.id
    SET 
      a.check_out_time = '18:00:00',
      a.status = CASE WHEN LOWER(a.status)='present' THEN 'late' ELSE a.status END
    WHERE a.date = ? AND HOUR(a.check_in_time) < 12
      AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
      AND e.role = 'staff'
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
    UPDATE attendance a
    JOIN employee e ON a.numerical_id = e.id
    SET 
      a.check_out_time = '07:00:00',
      a.status = CASE WHEN LOWER(a.status)='present' THEN 'late' ELSE a.status END
    WHERE a.date = ? AND HOUR(a.check_in_time) >= 12
      AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
      AND e.role = 'staff'
  `;
  db.query(sql, [yesterday], (err) => {
    if (err) console.error("[06:00] Auto-checkout night shifts failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });

// ===== Saturday early checkout for day shifts =====
cron.schedule("0 15 * * 6", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance a
    JOIN employee e ON a.numerical_id = e.id
    SET 
      a.check_out_time = '15:00:00',
      a.status = CASE WHEN LOWER(a.status)='present' THEN 'late' ELSE a.status END
    WHERE a.date = ? AND HOUR(a.check_in_time) < 12
      AND a.check_in_time IS NOT NULL AND a.check_out_time IS NULL
      AND e.role = 'staff'
  `;
  db.query(sql, [today], (err) => {
    if (err) console.error("[Saturday 15:00] Auto-checkout failed:", err);
  });
}, { timezone: "Africa/Dar_es_Salaam" });
