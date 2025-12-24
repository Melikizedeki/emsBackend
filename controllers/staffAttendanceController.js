import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

/* ======================================================
   🧠 LOCAL DATE & TIME HELPERS
====================================================== */
const getLocalDate = (offsetDays = 0) => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
};

const getLocalTime = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return now.toTimeString().slice(0, 8); // HH:MM:SS
};

const getLocalDay = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
};

/* ======================================================
   🕛 00:00 — INITIALIZE TODAY ATTENDANCE (Mon-Fri)
====================================================== */
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const dayOfWeek = getLocalDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends

      // Insert pending attendance for all employees who don't have a record yet
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

      console.log("✅ Attendance initialized for", today);
    } catch (err) {
      console.error("❌ Attendance initialization error:", err);
    }
  },
  { timezone: TZ }
);

/* ======================================================
   🕚 23:50 — FINALIZE TODAY ATTENDANCE (Mon-Fri)
====================================================== */
cron.schedule(
  "50 23 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const dayOfWeek = getLocalDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends

      // Update attendance status if check-in/check-out missing
      await pool.query(
        `
        UPDATE attendance
        SET
          status = CASE
            WHEN check_in_time IS NULL THEN 'absent'
            WHEN check_out_time IS NULL THEN 'late'
            ELSE status
          END,
          check_in_time = IFNULL(check_in_time, '00:00:00'),
          check_out_time = IFNULL(check_out_time, '00:00:00')
        WHERE date = ?
        `,
        [today]
      );

      console.log("✅ Attendance finalized for", today);
    } catch (err) {
      console.error("❌ Attendance finalization error:", err);
    }
  },
  { timezone: TZ }
);

/* ======================================================
   ⏱️ Check-in Function
====================================================== */
export const checkIn = async (numerical_id) => {
  const now = getLocalTime();
  const dayOfWeek = getLocalDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) throw new Error("No attendance on weekends.");

  let status;
  if (now >= "07:30:00" && now <= "08:00:00") status = "present";
  else if (now >= "08:01:00" && now <= "09:00:00") status = "late";
  else throw new Error("Check-in allowed only between 07:30 and 09:00.");

  const today = getLocalDate();
  await pool.query(
    `UPDATE attendance SET check_in_time = ?, status = ? WHERE numerical_id = ? AND date = ?`,
    [now, status, numerical_id, today]
  );

  return { message: `Check-in successful. Status: ${status}` };
};

/* ======================================================
   ⏱️ Check-out Function
====================================================== */
export const checkOut = async (numerical_id) => {
  const now = getLocalTime();
  const dayOfWeek = getLocalDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) throw new Error("No attendance on weekends.");
  if (now < "18:00:00" || now > "23:45:00") throw new Error("Check-out allowed only between 18:00 and 23:45.");

  const today = getLocalDate();
  await pool.query(
    `UPDATE attendance SET check_out_time = ? WHERE numerical_id = ? AND date = ?`,
    [now, numerical_id, today]
  );

  return { message: "Check-out successful." };
};

/* ======================================================
   📝 Get Attendance by Employee
====================================================== */
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { numerical_id } = req.params;
    const today = getLocalDate();

    const [rows] = await pool.query(
      `SELECT * FROM attendance WHERE numerical_id = ? AND date = ?`,
      [numerical_id, today]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "No attendance record found for today." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};
