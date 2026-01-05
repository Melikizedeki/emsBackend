import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

/* ======================================================
   🧠 LOCAL DATE & TIME HELPERS (NO UTC BUG)
====================================================== */
const getLocalNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const getLocalDate = (offsetDays = 0) => {
  const now = getLocalNow();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // YYYY-MM-DD (LOCAL)
};

const getLocalTime = () => getLocalNow().toTimeString().slice(0, 8); // HH:mm:ss
const getLocalDay = () => getLocalNow().getDay(); // 0=Sun ... 6=Sat

/* ======================================================
   🕛 00:00 — INITIALIZE ATTENDANCE (MON–FRI + SATURDAY)
====================================================== */
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const day = getLocalDay();

      // Skip Sunday
      if (day === 0) return;

      await pool.query(
        `INSERT INTO attendance (numerical_id, date, status)
         SELECT e.id, ?, 'pending'
         FROM employee e
         WHERE NOT EXISTS (
           SELECT 1
           FROM attendance a
           WHERE a.numerical_id = e.id AND a.date = ?
         )`,
        [today, today]
      );
    } catch (err) {
      // Handle error silently or log to a file in production
    }
  },
  { timezone: TZ }
);

/* ======================================================
   🕚 23:50 — FINALIZE ATTENDANCE (MON–FRI + SATURDAY)
====================================================== */
cron.schedule(
  "27 17 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const day = getLocalDay();

      // Skip Sunday
      if (day === 0) return;

      await pool.query(
        `UPDATE attendance
         SET status = CASE
             WHEN check_in_time IS NULL THEN 'absent'
             WHEN check_out_time IS NULL THEN 'late'
             ELSE status
           END,
           check_in_time = IFNULL(check_in_time, '00:00:00'),
           check_out_time = IFNULL(check_out_time, '00:00:00')
         WHERE date = ?`,
        [today]
      );
    } catch (err) {
      // Handle error silently or log to a file in production
    }
  },
  { timezone: TZ }
);
