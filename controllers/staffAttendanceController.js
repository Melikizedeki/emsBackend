import pool from "../configs/db.js";

/* ======================================================
   📍 GEOFENCE
====================================================== */
const GEOFENCE_CENTER = { lat: -3.69019, lng: 33.41387 };
const GEOFENCE_RADIUS = 100;

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
   🕒 TIME HELPERS
====================================================== */
const getTodayDate = () => new Date().toISOString().split("T")[0];
const getYesterdayDate = () =>
  new Date(Date.now() - 86400000).toISOString().split("T")[0];
const getCurrentTime = () => new Date().toTimeString().slice(0, 8);
const getDayOfWeek = () => new Date().getDay(); // 0=Sunday, 6=Saturday

/* ======================================================
   ✅ CHECK-IN (STAFF & FIELD)
====================================================== */
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!latitude || !longitude)
      return res.status(400).json({ message: "Coordinates required" });

    const distance = haversineDistance(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng
    );
    if (distance > GEOFENCE_RADIUS)
      return res.status(403).json({ message: "Outside company area" });

    const time = getCurrentTime();
    const date = getTodayDate();
    let status = null;

    // Day shift: 07:30–08:00 present, 08:01–09:00 late
    if (time >= "07:30:00" && time <= "08:00:00") status = "present";
    else if (time >= "08:01:00" && time <= "09:00:00") status = "late";

    // Night shift: 19:30–20:00 present, 20:01–21:00 late
    else if (time >= "19:30:00" && time <= "20:00:00") status = "present";
    else if (time >= "20:01:00" && time <= "21:00:00") status = "late";

    if (!status)
      return res.status(403).json({
        message: "❌ Check-in not allowed at this time",
      });

    const [exists] = await pool.query(
      `SELECT id FROM attendance
       WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL`,
      [numerical_id, date]
    );

    if (exists.length)
      return res.status(409).json({ message: "❌ Already checked in" });

    await pool.query(
      `UPDATE attendance
       SET check_in_time=?, status=?
       WHERE numerical_id=? AND date=?`,
      [time, status, numerical_id, date]
    );

    res.json({ message: "✅ Check-in successful", status, time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   ✅ CHECK-OUT (STAFF & FIELD, NIGHT SAFE, SATURDAY STAFF)
====================================================== */
export const checkOut = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!latitude || !longitude)
      return res.status(400).json({ message: "Coordinates required" });

    const distance = haversineDistance(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng
    );
    if (distance > GEOFENCE_RADIUS)
      return res.status(403).json({ message: "Outside company area" });

    const time = getCurrentTime();
    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    const dayOfWeek = getDayOfWeek(); // 6 = Saturday

    // Fetch today's and yesterday's attendance
    const [todayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, today]
    );
    const [yesterdayRow] = await pool.query(
      `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
      [numerical_id, yesterday]
    );

    // Fetch employee role
    const [roleRow] = await pool.query(
      `SELECT role FROM employee WHERE id=?`,
      [numerical_id]
    );
    const role = roleRow.length ? roleRow[0].role : null;

    let date = today;

    // ---------- SATURDAY STAFF CHECKOUT ----------
    if (dayOfWeek === 6 && role === "staff" && todayRow.length && todayRow[0].check_in_time) {
      if (time < "12:30:00") {
        return res.status(403).json({
          message: "❌ Staff can checkout only after 15:00 on Saturday",
        });
      }
      date = today;
    }
    // ---------- DAY SHIFT (Mon–Fri) ----------
    else if (todayRow.length && todayRow[0].check_in_time) {
      const checkInTime = todayRow[0].check_in_time;
      if (checkInTime >= "07:30:00" && checkInTime <= "09:00:00") {
        if (!(time >= "18:00:00" && time <= "18:59:59")) {
          return res.status(403).json({
            message: "❌ Day shift can only checkout between 18:00–18:59",
          });
        }
      }
      // NIGHT SHIFT (checkout next morning)
      else if (checkInTime >= "19:30:00" && checkInTime <= "21:00:00") {
        if (!(time >= "06:00:00" && time <= "07:55:00")) {
          return res.status(403).json({
            message: "❌ Night shift checkout allowed only next morning 06:00–07:55",
          });
        }
        date = yesterday;
      } else {
        return res.status(403).json({ message: "❌ Invalid check-in time for checkout" });
      }
    }
    // ---------- NIGHT SHIFT from yesterday ----------
    else if (
      yesterdayRow.length &&
      yesterdayRow[0].check_in_time >= "19:30:00" &&
      yesterdayRow[0].check_in_time <= "21:00:00" &&
      time >= "06:00:00" &&
      time <= "07:55:00"
    ) {
      date = yesterday;
    } else {
      return res.status(404).json({ message: "❌ No active shift found" });
    }

    const [result] = await pool.query(
      `UPDATE attendance
       SET check_out_time=?
       WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL AND check_out_time IS NULL`,
      [time, numerical_id, date]
    );

    if (!result.affectedRows)
      return res.status(404).json({ message: "❌ No active shift found" });

    res.json({ message: "✅ Check-out successful", time, date });
  } catch (err) {
    console.error(err);
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
      `SELECT date, check_in_time, check_out_time, status
       FROM attendance
       WHERE numerical_id=?
       ORDER BY date DESC`,
      [numerical_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
