import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

/* ======================================================
   🧠 LOCAL DATE HELPER (TZ SAFE)
====================================================== */
const getLocalDate = (offsetDays = 0) => {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ })
  );
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0];
};

/* ======================================================
   🕛 00:00 — INITIALIZE TODAY ATTENDANCE
====================================================== */
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = getLocalDate(0);

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
      console.error("❌ INIT ERROR:", err);
    }
  },
  { timezone: TZ }
);

/* ======================================================
   🕘 11:05 — FINALIZE YESTERDAY (SAFE)
   Runs AFTER all shifts are impossible
====================================================== */
cron.schedule(
  "5 11 * * *",
  async () => {
    try {
      const yesterday = getLocalDate(-1);

      await pool.query(`
        UPDATE attendance
        SET
          status = CASE
            WHEN check_in_time IS NULL THEN 'absent'
            WHEN check_out_time IS NULL THEN 'late'
            ELSE status
          END,
          check_in_time  = IFNULL(check_in_time, '00:00:00'),
          check_out_time = IFNULL(check_out_time, '00:00:00')
        WHERE date = ?
      `, [yesterday]);

      console.log("✅ Attendance finalized safely:", yesterday);
    } catch (err) {
      console.error("❌ FINALIZE ERROR:", err);
    }
  },
  { timezone: TZ }
);
