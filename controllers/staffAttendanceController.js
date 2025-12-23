import pool from "../configs/db.js";

/* ======================================================
   📍 GEOFENCE CONFIG
====================================================== */
const COMPANY_CENTER = { lat: -4.822958, lng: 34.76901956 };
const GEOFENCE_RADIUS = 1000; // meters

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ======================================================
   🕒 TIME HELPERS (Tanzania time)
====================================================== */
const getTzDate = () => new Date().toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" });
const getTodayDate = () => new Date(getTzDate()).toISOString().split("T")[0];
const getYesterdayDate = () => {
  const d = new Date(getTzDate());
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
const getCurrentTime = () => new Date(getTzDate()).toTimeString().slice(0, 8);
const getDayOfWeek = () => new Date(getTzDate()).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", weekday: "long" });

/* ======================================================
   ✅ CHECK-IN
====================================================== */
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!numerical_id || latitude == null || longitude == null)
      return res.status(400).json({ message: "Missing required fields" });

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ message: "Invalid coordinates" });

    const distance = haversineDistance(lat, lng, COMPANY_CENTER.lat, COMPANY_CENTER.lng);
    if (distance > GEOFENCE_RADIUS)
      return res.status(403).json({ message: "Outside company area" });

    const time = getCurrentTime();
    const date = getTodayDate();
    let status = null;

    // Day shift
    if (time >= "07:30:00" && time <= "08:00:00") status = "present";
    else if (time >= "08:01:00" && time <= "09:00:00") status = "late";

    // Night shift
    else if (time >= "19:30:00" && time <= "20:00:00") status = "present";
    else if (time >= "20:01:00" && time <= "21:00:00") status = "late";

    if (!status)
      return res.status(403).json({ message: "Check-in not allowed at this time" });

    const [exists] = await pool.query(
      `SELECT id FROM attendance WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL`,
      [numerical_id, date]
    );
    if (exists.length) return res.status(409).json({ message: "Already checked in" });

    const [result] = await pool.query(
      `UPDATE attendance SET check_in_time=?, status=? WHERE numerical_id=? AND date=?`,
      [time, status, numerical_id, date]
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "Attendance row not found (cron not initialized)" });

    res.json({ message: "Check-in successful", status, time });
  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   ✅ CHECK-OUT
====================================================== */
export const checkOut = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!numerical_id || latitude == null || longitude == null)
      return res.status(400).json({ message: "Missing required fields" });

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ message: "Invalid coordinates" });

    const distance = haversineDistance(lat, lng, COMPANY_CENTER.lat, COMPANY_CENTER.lng);
    if (distance > GEOFENCE_RADIUS)
      return res.status(403).json({ message: "Outside company area" });

    const time = getCurrentTime();
    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    const dayOfWeek = getDayOfWeek();

    const [roleRow] = await pool.query(`SELECT role FROM employee WHERE id=?`, [numerical_id]);
    const role = roleRow.length ? roleRow[0].role : null;

    const [todayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, today]
    );
    const [yesterdayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, yesterday]
    );

    let date = today;

    // ✅ Tuesday special rule for staff
    if (dayOfWeek === "Tuesday" && role === "staff" && todayRow.length && todayRow[0].check_in_time) {
      if (time < "13:00:00") {
        return res.status(403).json({ message: "Staff can checkout after 13:00 on Tuesday" });
      }
    }

    // DAY/NIGHT SHIFT logic
    if (todayRow.length && todayRow[0].check_in_time) {
      const ci = todayRow[0].check_in_time;

      // Day shift
      if (ci >= "07:30:00" && ci <= "09:00:00") {
        if (!(time >= "18:00:00" && time <= "18:59:59")) {
          return res.status(403).json({ message: "Day shift checkout: 18:00–18:59" });
        }
      }

      // Night shift
      else if (ci >= "19:30:00" && ci <= "21:00:00") {
        if (!(time >= "06:00:00" && time <= "07:55:00")) {
          return res.status(403).json({ message: "Night shift checkout: 06:00–07:55" });
        }
        date = yesterday;
      }
    }
    // Night shift from yesterday
    else if (
      yesterdayRow.length &&
      yesterdayRow[0].check_in_time >= "19:30:00" &&
      yesterdayRow[0].check_in_time <= "21:00:00" &&
      time >= "06:00:00" &&
      time <= "07:55:00"
    ) {
      date = yesterday;
    } else {
      return res.status(404).json({ message: "No active shift found" });
    }

    const [result] = await pool.query(
      `UPDATE attendance SET check_out_time=? WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL AND check_out_time IS NULL`,
      [time, numerical_id, date]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "No active shift found" });

    res.json({ message: "Check-out successful", time, date });
  } catch (err) {
    console.error("CHECK-OUT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   📄 ATTENDANCE HISTORY
====================================================== */
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { numerical_id } = req.params;
    const [rows] = await pool.query(
      `SELECT date, check_in_time, check_out_time, status FROM attendance WHERE numerical_id=? ORDER BY date DESC`,
      [numerical_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
