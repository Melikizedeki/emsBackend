import pool from "../configs/db.js";

/* ======================================================
   📍 GEOFENCE CONFIG
====================================================== */
const COMPANY_CENTER = { lat: -4.822958, lng: 34.76901956 };
const GEOFENCE_RADIUS = 1000; // meters

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; 
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
   🕒 TIME HELPERS (Tanzania)
====================================================== */
const getTzDate = () => {
  const now = new Date();
  const tzOffset = 3 * 60; 
  return new Date(now.getTime() + tzOffset * 60 * 1000);
};

const timeToSeconds = (time) => {
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

const getTodayDate = () => getTzDate().toISOString().split("T")[0];
const getYesterdayDate = () => {
  const d = getTzDate();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
const getCurrentTime = () => getTzDate().toTimeString().slice(0, 8);
const getDayOfWeek = () => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][getTzDate().getDay()];

/* ======================================================
   ✅ CHECK-IN
====================================================== */
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!numerical_id || latitude == null || longitude == null)
      return res.status(400).json({ message: "Missing required fields" });

    const distance = haversineDistance(Number(latitude), Number(longitude), COMPANY_CENTER.lat, COMPANY_CENTER.lng);
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
    const { numerical_id, latitude, longitude, role } = req.body;
    if (!numerical_id || latitude == null || longitude == null)
      return res.status(400).json({ message: "Missing required fields" });

    const distance = haversineDistance(Number(latitude), Number(longitude), COMPANY_CENTER.lat, COMPANY_CENTER.lng);
    if (distance > GEOFENCE_RADIUS)
      return res.status(403).json({ message: "Outside company area" });

    const nowTime = getCurrentTime();
    const nowSeconds = timeToSeconds(nowTime);
    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    const dayOfWeek = getDayOfWeek();
    const userRole = role || "staff";

    const [todayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, today]
    );
    const [yesterdayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, yesterday]
    );

    let dateToUpdate = today;
    let checkInTime = todayRow[0]?.check_in_time || yesterdayRow[0]?.check_in_time;

    if (!checkInTime) return res.status(404).json({ message: "No active shift found" });

    const ciSeconds = timeToSeconds(checkInTime);

    // Tuesday staff rule
    if (dayOfWeek === "Tuesday" && userRole === "staff" && nowSeconds < 13*3600) {
      return res.status(403).json({ message: "Staff can checkout after 13:00 on Tuesday" });
    }

    // Day shift 07:30–09:00, checkout 18:00–18:59
    if (ciSeconds >= 7*3600 + 30*60 && ciSeconds <= 9*3600) {
      if (!(nowSeconds >= 18*3600 && nowSeconds <= 18*3600 + 59*60 + 59)) {
        return res.status(403).json({ message: "Day shift checkout allowed 18:00–18:59" });
      }
    }

    // Night shift 19:30–21:00, checkout 06:00–07:55
    else if (ciSeconds >= 19*3600 + 30*60 && ciSeconds <= 21*3600) {
      if (!(nowSeconds >= 6*3600 && nowSeconds <= 7*3600 + 55*60)) {
        return res.status(403).json({ message: "Night shift checkout allowed 06:00–07:55" });
      }
      dateToUpdate = yesterday;
    }

    const [result] = await pool.query(
      `UPDATE attendance SET check_out_time=? WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL AND check_out_time IS NULL`,
      [nowTime, numerical_id, dateToUpdate]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "No active shift found" });

    res.json({ message: "Check-out successful", time: nowTime, date: dateToUpdate });
  } catch (err) {
    console.error("CHECK-OUT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   📄 GET ATTENDANCE HISTORY
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
