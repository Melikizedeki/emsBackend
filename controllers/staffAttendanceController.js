import cron from "node-cron";
import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";

/* ======================================================
   🧠 LOCAL DATE & TIME HELPERS
====================================================== */
const getLocalNow = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const getLocalDate = (offsetDays = 0) => {
  const now = getLocalNow();
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
};

const getLocalTime = () => {
  const now = getLocalNow();
  return now.toTimeString().slice(0, 8); // HH:MM:SS
};

const getLocalDay = () => getLocalNow().getDay(); // 0–6

/* ======================================================
   🕛 00:00 — INITIALIZE TODAY ATTENDANCE (Mon–Fri)
====================================================== */
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = getLocalDate();
      const day = getLocalDay();

      if (day === 0 || day === 6) return;

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

/* ======================================================
   🕚 23:50 — FINALIZE TODAY ATTENDANCE (Mon–Fri)
====================================================== */
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
          check_in_time  = IFNULL(check_in_time,  '00:00:00'),
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

/* ======================================================
   ⏱️ CHECK-IN (Express Controller)
====================================================== */
export const checkIn = async (req, res) => {
  try {
    const { numerical_id } = req.body;

    const now = getLocalTime();
    const day = getLocalDay();

    if (day === 0 || day === 6)
      return res.status(400).json({ message: "No attendance on weekends." });

    let status;
    if (now >= "07:30:00" && now <= "08:00:00") status = "present";
    else if (now >= "08:01:00" && now <= "09:00:00") status = "late";
    else
      return res
        .status(400)
        .json({ message: "Check-in allowed 07:30–09:00 only." });

    const today = getLocalDate();

    await pool.query(
      `
      UPDATE attendance
      SET check_in_time = ?, status = ?
      WHERE numerical_id = ? AND date = ?
      `,
      [now, status, numerical_id, today]
    );

    res.json({ message: `Check-in successful. Status: ${status}` });
  } catch (err) {
    console.error("❌ Check-in error:", err);
    res.status(500).json({ message: "Check-in failed" });
  }
};

/* ======================================================
   ⏱️ CHECK-OUT (Express Controller)
====================================================== */
export const checkOut = async (req, res) => {
  try {
    const { numerical_id } = req.body;

    const now = getLocalTime();
    const day = getLocalDay();

    if (day === 0 || day === 6)
      return res.status(400).json({ message: "No attendance on weekends." });

    if (now < "18:00:00" || now > "23:45:00")
      return res
        .status(400)
        .json({ message: "Check-out allowed 18:00–23:45 only." });

    const today = getLocalDate();

    await pool.query(
      `
      UPDATE attendance
      SET check_out_time = ?
      WHERE numerical_id = ? AND date = ?
      `,
      [now, numerical_id, today]
    );

    res.json({ message: "Check-out successful." });
  } catch (err) {
    console.error("❌ Check-out error:", err);
    res.status(500).json({ message: "Check-out failed" });
  }
};

/* ======================================================
   📝 GET ATTENDANCE BY EMPLOYEE (ARRAY RETURN)
====================================================== */
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { numerical_id } = req.params;
    const today = getLocalDate();

    const [rows] = await pool.query(
      `
      SELECT *
      FROM attendance
      WHERE numerical_id = ? AND date = ?
      ORDER BY date DESC
      `,
      [numerical_id, today]
    );

    // ✅ ALWAYS return array
    res.json(rows);
  } catch (err) {
    console.error("❌ Get attendance error:", err);
    res.status(500).json({ message: "Failed to load attendance" });
  }
};
