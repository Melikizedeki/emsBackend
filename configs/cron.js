import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

/* ======================================================
   🕛 00:00 — CREATE NEW DAY
====================================================== */
cron.schedule("0 0 * * *", async () => {
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
}, { timezone: TZ });

/* ======================================================
   🕕 06:00 — AUTO CLOSE MISSED NIGHT CHECKOUTS (YESTERDAY)
====================================================== */
cron.schedule("0 6 * * *", async () => {
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

  console.log("✅ Night shifts auto-closed:", yesterday);
}, { timezone: TZ });

/* ======================================================
   🕙 10:23 — FINALIZE PREVIOUS DAY
====================================================== */
cron.schedule("23 10 * * *", async () => {
  const businessDate = new Date(Date.now() - 86400000)
    .toISOString()
    .split("T")[0];

  await pool.query(`
    UPDATE attendance
    SET status='absent',
        check_in_time='00:00:00',
        check_out_time='00:00:00'
    WHERE date=?
      AND status='pending'
  `, [businessDate]);

  console.log("✅ Attendance finalized:", businessDate);
}, { timezone: TZ });
