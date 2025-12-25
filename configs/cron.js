import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

// ----------------------------------------
// Date & Time Helpers
// ----------------------------------------
const getLocalNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
const getLocalDate = (offsetDays = 0) => {
  const now = getLocalNow();
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
};
const getLocalDay = () => getLocalNow().getDay(); // 0=Sun ... 6=Sat

// ----------------------------------------
// 00:00 — Initialize Attendance (Mon–Fri)
// ----------------------------------------
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const day = getLocalDay();
      if (day === 0 || day === 6) return; // skip weekends

      await pool.query(
        `
        INSERT INTO attendance (numerical_id, date, status)
        SELECT id, ?, 'pending'
        FROM employee
        WHERE id NOT IN (
          SELECT numerical_id FROM attendance WHERE date = ?
        )
        `,
        [today, today]
      );

      console.log("✅ Attendance initialized:", today);
    } catch (err) {
      console.error("❌ Init attendance error:", err);
    }
  },
  { timezone: TZ }
);

// ----------------------------------------
// 23:50 — Finalize Attendance (Mon–Fri)
// ----------------------------------------
cron.schedule(
  "50 23 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const day = getLocalDay();
      if (day === 0 || day === 6) return;

      await pool.query(
        `
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
        `,
        [today]
      );

      console.log("✅ Attendance finalized:", today);
    } catch (err) {
      console.error("❌ Finalize attendance error:", err);
    }
  },
  { timezone: TZ }
);
