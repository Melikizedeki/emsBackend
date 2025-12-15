import cron from "node-cron";
import db from "./db.js";
import fs from "fs";
import path from "path";

// ✅ Create daily blank attendance records (e.g., at 00:01 AM)
cron.schedule("1 0 * * *", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    INSERT INTO attendance (numerical_id, date, status)
    SELECT id, ?, 'Pending' FROM employee
    WHERE id NOT IN (
      SELECT numerical_id FROM attendance WHERE DATE(date) = ?
    )
  `;
  db.query(sql, [today, today], (err, result) => {
    if (err) {
      console.error("❌ Error inserting daily attendance:", err);
    } else {
      // console.log removed for production
    }
  });
});

// ✅ Auto-mark Pending → Absent at 19:00
cron.schedule("0 19 * * *", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance
    SET status = 'Absent'
    WHERE DATE(date) = ? AND (status = 'Pending' OR status IS NULL)
  `;
  db.query(sql, [today], (err, result) => {
    if (err) {
      console.error("❌ Error auto-marking absent:", err);
    } else {
      // console.log removed for production
    }
  });
});

// ===== Auto-checkout day shifts at 18:00 =====
cron.schedule("0 18 * * *", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance
    SET check_out_time = '18:00:00', status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END, punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND check_in_time IS NOT NULL AND check_out_time IS NULL AND (shift = 'day' OR shift IS NULL)
  `;
  db.query(sql, [today], (err, result) => {
    if (err) console.error('[autoCheckout 18:00] failed', err);
    else {
      // console.log removed for production
    }
  });
}, { timezone: 'Africa/Dar_es_Salaam' });

// ===== Auto-checkout night shifts at 06:00 (for previous date) =====
cron.schedule("0 6 * * *", () => {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const sql = `
    UPDATE attendance
    SET check_out_time = '06:00:00', status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END, punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND check_in_time IS NOT NULL AND check_out_time IS NULL AND shift = 'night'
  `;
  db.query(sql, [yesterday], (err, result) => {
    if (err) console.error('[autoCheckout 06:00] failed', err);
    else {
      // console.log removed for production
    }
  });
}, { timezone: 'Africa/Dar_es_Salaam' });

// ===== Saturday auto-checkout at 15:00 for day shifts =====
cron.schedule("0 15 * * 6", () => {
  const today = new Date().toISOString().split("T")[0];
  const sql = `
    UPDATE attendance
    SET check_out_time = '15:00:00', status = CASE WHEN LOWER(status) = 'present' THEN 'late' ELSE status END, punctuality = CASE WHEN LOWER(status) = 'present' THEN 50 ELSE punctuality END
    WHERE date = ? AND check_in_time IS NOT NULL AND check_out_time IS NULL AND DAYOFWEEK(date) = 7
  `;
  db.query(sql, [today], (err, result) => {
    if (err) console.error('[autoCheckout Sat 15:00] failed', err);
    else {
      // console.log removed for production
    }
  });
}, { timezone: 'Africa/Dar_es_Salaam' });

// ===== Daily report generator at 08:00 for previous day =====
cron.schedule("0 8 * * *", () => {
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const sql = `
    SELECT e.id AS employee_id, e.employee_id AS emp_code, e.name, e.role, a.date,
      a.shift, a.check_in_time, a.check_out_time, a.status, IFNULL(a.punctuality, 0) AS punctuality
    FROM employee e
    LEFT JOIN attendance a ON a.numerical_id = e.id AND a.date = ?
    ORDER BY e.name ASC
  `;
  db.query(sql, [day], (err, rows) => {
    if (err) return console.error('[dailyReport] query failed', err);
    const reportsDir = path.join(process.cwd(), 'server', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const filePath = path.join(reportsDir, `${day}.json`);
    fs.writeFile(filePath, JSON.stringify(rows, null, 2), (err2) => {
      if (err2) return console.error('[dailyReport] write failed', err2);
      // console.log removed for production
    });
  });
}, { timezone: 'Africa/Dar_es_Salaam' });
