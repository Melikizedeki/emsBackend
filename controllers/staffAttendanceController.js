// controllers/staffAttendanceController.js
import pool from "../configs/db.js";

// ======================================================
// 📍 GEOFENCE
// ======================================================
const GEOFENCE_CENTER = { lat: -3.69019, lng: 33.41387 };
const GEOFENCE_RADIUS = 100; // meters

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

// ======================================================
// 🕒 TIME HELPERS (SAME LOGIC AS ADMIN)
// ======================================================
const getTodayDate = () =>
  new Date().toISOString().split("T")[0];

const getYesterdayDate = () =>
  new Date(Date.now() - 86400000).toISOString().split("T")[0];

const getCurrentTime = () =>
  new Date().toTimeString().slice(0, 8);

// ======================================================
// ✅ STAFF CHECK-IN (ADMIN-LIKE)
// ======================================================
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Coordinates required" });
    }

    // 📍 Geofence validation
    const distance = haversineDistance(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng
    );

    if (distance > GEOFENCE_RADIUS) {
      return res.status(403).json({ message: "Outside company area" });
    }

    const time = getCurrentTime();
    const date = getTodayDate();

    // ⏱ Determine status (EXACTLY LIKE ADMIN)
    let status = null;

    // Day shift
    if (time >= "07:30:00" && time <= "08:00:00") status = "present";
    else if (time >= "08:01:00" && time <= "09:00:00") status = "late";

    // Night shift
    else if (time >= "19:30:00" && time <= "20:00:00") status = "present";
    else if (time >= "20:01:00" && time <= "21:00:00") status = "late";

    // ❌ Block invalid times (IMPORTANT)
    if (!status) {
      return res.status(403).json({
        message: "❌ Check-in not allowed at this time",
      });
    }

    // ❌ Prevent double check-in
    const [existing] = await pool.query(
      `SELECT check_in_time
       FROM attendance
       WHERE numerical_id=? AND date=? AND check_in_time IS NOT NULL`,
      [numerical_id, date]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "❌ Check-in already recorded",
      });
    }

    // ✅ Update attendance (record already created by cron)
    await pool.query(
      `UPDATE attendance
       SET check_in_time=?, status=?
       WHERE numerical_id=? AND date=?`,
      [time, status, numerical_id, date]
    );

    res.json({
      message: "✅ Check-in successful",
      status,
      time,
    });
  } catch (err) {
    console.error("Staff check-in error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================================================
// ✅ STAFF CHECK-OUT (ADMIN-LIKE)
// ======================================================
export const checkOut = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Coordinates required" });
    }

    // 📍 Geofence validation
    const distance = haversineDistance(
      latitude,
      longitude,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng
    );

    if (distance > GEOFENCE_RADIUS) {
      return res.status(403).json({ message: "Outside company area" });
    }

    const time = getCurrentTime();
    let date = getTodayDate();

    // 🌙 Night shift checkout → yesterday
    if (time >= "06:00:00" && time <= "07:55:00") {
      date = getYesterdayDate();
    }

    const [result] = await pool.query(
      `UPDATE attendance
       SET check_out_time=?
       WHERE numerical_id=? AND date=?
         AND check_in_time IS NOT NULL
         AND check_out_time IS NULL`,
      [time, numerical_id, date]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "❌ No active check-in found",
      });
    }

    res.json({
      message: "✅ Check-out successful",
      time,
    });
  } catch (err) {
    console.error("Staff check-out error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================================================
// 📄 STAFF ATTENDANCE HISTORY
// ======================================================
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
    console.error("Fetch attendance error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
