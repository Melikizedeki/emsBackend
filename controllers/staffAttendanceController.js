import pool from "../configs/db.js";
import { getDarTime } from "../utils/tz.js"; // reliable Tanzania time

const GEOFENCE_CENTER = { lat: -3.69019, lng: 33.41387 };
const GEOFENCE_RADIUS = 100; // meters

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ================= CHECK-IN =================
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!latitude || !longitude)
      return res.status(400).json({ message: "Coordinates required" });

    const distance = haversineDistance(latitude, longitude, GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng);
    if (distance > GEOFENCE_RADIUS)
      return res.status(400).json({ message: "Outside company area" });

    const { date, time } = getDarTime();

    // ===== Determine status based on time =====
    let status = "pending"; // default
    if (time >= "07:30:00" && time <= "08:00:00") status = "present";
    else if (time >= "08:01:00" && time <= "09:00:00") status = "late";
    else if (time >= "19:30:00" && time <= "20:00:00") status = "present";
    else if (time >= "20:01:00" && time <= "21:00:00") status = "late";
    else status = "absent"; // all other times

    const [rows] = await pool.query(
      "SELECT * FROM attendance WHERE numerical_id=? AND date=?",
      [numerical_id, date]
    );

    if (rows.length > 0 && rows[0].check_in_time)
      return res.status(409).json({ message: "Check-in already done today" });

    if (rows.length > 0) {
      await pool.query(
        "UPDATE attendance SET check_in_time=?, status=? WHERE numerical_id=? AND date=?",
        [time, status, numerical_id, date]
      );
    } else {
      await pool.query(
        "INSERT INTO attendance (numerical_id, date, check_in_time, status) VALUES (?, ?, ?, ?)",
        [numerical_id, date, time, status]
      );
    }

    res.json({ message: `Check-in ${status}`, time });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================= CHECK-OUT =================
export const checkOut = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;
    if (!latitude || !longitude)
      return res.status(400).json({ message: "Coordinates required" });

    const distance = haversineDistance(latitude, longitude, GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng);
    if (distance > GEOFENCE_RADIUS)
      return res.status(400).json({ message: "Outside company area" });

    const { date, time, day } = getDarTime();
    let attendanceDate = date;

    // ===== Determine shift logic like admin cron =====
    const isDayCheckout = time >= "18:00:00" && time <= "18:59:59";
    const isNightCheckout = time >= "06:00:00" && time <= "06:59:59";
    const isSatCheckout = day === 6 && time >= "15:00:00" && time <= "15:59:59";

    if (isNightCheckout) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      attendanceDate = y.toISOString().split("T")[0];
    }

    if (!isDayCheckout && !isNightCheckout && !isSatCheckout)
      return res.status(400).json({ message: "Check-out not allowed at this time" });

    const [rows] = await pool.query(
      "SELECT * FROM attendance WHERE numerical_id=? AND date=?",
      [numerical_id, attendanceDate]
    );

    if (rows.length === 0 || !rows[0].check_in_time)
      return res.status(400).json({ message: "You must check-in first" });

    await pool.query(
      "UPDATE attendance SET check_out_time=? WHERE numerical_id=? AND date=?",
      [time, numerical_id, attendanceDate]
    );

    res.json({ message: "Check-out successful", time });
  } catch (err) {
    console.error("Check-out error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
