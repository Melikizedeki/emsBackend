// cron/attendanceCron.js
import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

// ======================================================
// 🕛 00:00 — Initialize attendance (ALL workers)
// ======================================================
cron.schedule("0 0 * * *", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];

    await pool.query(`
      INSERT INTO attendance (numerical_id, date, status)
      SELECT id, ?, 'pending'
      FROM employee
      WHERE id NOT IN (
        SELECT numerical_id FROM attendance WHERE date = ?
      )
    `, [today, today]);

    console.log("✅ Attendance initialized:", today);
  } catch (err) {
    console.error("[00:00] Init failed:", err.message);
  }
}, { timezone: TZ });


// ======================================================
// 🕕 06:00 — Auto close night checkouts (yesterday)
// ======================================================
cron.schedule("0 6 * * *", async () => {
  try {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    await pool.query(`
      UPDATE attendance
      SET check_out_time='00:00:00', status='late'
      WHERE date=?
        AND check_in_time IS NOT NULL
        AND check_out_time IS NULL
    `, [yesterday]);

    console.log("✅ Night checkout auto-closed:", yesterday);
  } catch (err) {
    console.error("[06:00] Night close failed:", err.message);
  }
}, { timezone: TZ });


// ======================================================
// 🕒 15:00 — Saturday early checkout (staff)
// ======================================================
cron.schedule("0 15 * * 6", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];

    await pool.query(`
      UPDATE attendance a
      JOIN employee e ON a.numerical_id=e.id
      SET a.check_out_time='00:00:00', a.status='late'
      WHERE a.date=?
        AND e.role='staff'
        AND a.check_in_time IS NOT NULL
        AND a.check_out_time IS NULL
    `, [today]);

    console.log("✅ Saturday checkout done:", today);
  } catch (err) {
    console.error("[15:00 Sat] Failed:", err.message);
  }
}, { timezone: TZ });



// ======================================================
// 🕘 09:20 — FINALIZE PREVIOUS BUSINESS DAY
// ======================================================
cron.schedule("48 9 * * *", async () => {
  try {
    const businessDate = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    // --------------------------------------------------
    // 1️⃣ PENDING → ABSENT (AUTO-FILL 00:00)
    // --------------------------------------------------
    await pool.query(`
      UPDATE attendance a
      JOIN employee e ON a.numerical_id = e.id
      SET 
        a.status = 'absent',
        a.check_in_time = '00:00:00',
        a.check_out_time = '00:00:00'
      WHERE a.date = ?
        AND a.status = 'pending'
        AND e.role <> 'admin'
    `, [businessDate]);

    // --------------------------------------------------
    // 2️⃣ ALREADY ABSENT → AUTO-FILL ONLY (DO NOT CHANGE STATUS)
    // --------------------------------------------------
    await pool.query(`
      UPDATE attendance a
      JOIN employee e ON a.numerical_id = e.id
      SET 
        a.check_in_time = '00:00:00',
        a.check_out_time = '00:00:00'
      WHERE a.date = ?
        AND a.status = 'absent'
        AND (a.check_in_time IS NULL OR a.check_out_time IS NULL)
        AND e.role <> 'admin'
    `, [businessDate]);

    // --------------------------------------------------
    // 3️⃣ CHECKED-IN BUT NO CHECKOUT → LATE
    // --------------------------------------------------
    await pool.query(`
      UPDATE attendance a
      JOIN employee e ON a.numerical_id = e.id
      SET 
        a.status = 'late',
        a.check_out_time = '00:00:00'
      WHERE a.date = ?
        AND a.check_in_time IS NOT NULL
        AND a.check_out_time IS NULL
        AND a.status IN ('present', 'pending')
        AND e.role <> 'admin'
    `, [businessDate]);

    console.log("✅ Attendance finalized safely:", businessDate);
  } catch (err) {
    console.error("[09:20] Attendance finalize failed:", err.message);
  }
}, { timezone: TZ });
