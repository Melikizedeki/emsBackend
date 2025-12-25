import pool from "../configs/db.js";

const TZ = "Africa/Dar_es_Salaam";
const COMPANY_CENTER = { lat: -4.822958, lng: 34.76901956 };
const GEOFENCE_RADIUS = 1000; // meters

// ----------------------------------------
// Helpers
// ----------------------------------------
const getLocalNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
const getLocalDate = (offsetDays = 0) => {
  const now = getLocalNow();
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0];
};
const getLocalTime = () => getLocalNow().toTimeString().slice(0, 8);
const getLocalDay = () => getLocalNow().getDay();

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

// ----------------------------------------
// Check-in
// ----------------------------------------
export const checkIn = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;

    const distance = haversineDistance(latitude, longitude, COMPANY_CENTER.lat, COMPANY_CENTER.lng);
    if (distance > GEOFENCE_RADIUS) {
      return res.status(403).json({ message: "❌ You are outside the company area" });
    }

    const now = getLocalTime();
    const day = getLocalDay();
    if (day === 0 || day === 6) return res.status(400).json({ message: "No attendance on weekends." });

    let status;
    if (now >= "07:30:00" && now <= "08:00:00") status = "present";
    else if (now >= "08:01:00" && now <= "09:00:00") status = "late";
    else return res.status(400).json({ message: "Check-in allowed 07:30–09:00 only." });

    const today = getLocalDate();

    await pool.query(
      `UPDATE attendance SET check_in_time = ?, status = ? WHERE numerical_id = ? AND date = ?`,
      [now, status, numerical_id, today]
    );

    res.json({ message: `✅ Check-in successful. Status: ${status}` });
  } catch (err) {
    console.error("❌ Check-in error:", err);
    res.status(500).json({ message: "Check-in failed" });
  }
};

// ----------------------------------------
// Check-out
// ----------------------------------------
export const checkOut = async (req, res) => {
  try {
    const { numerical_id, latitude, longitude } = req.body;

    const distance = haversineDistance(latitude, longitude, COMPANY_CENTER.lat, COMPANY_CENTER.lng);
    if (distance > GEOFENCE_RADIUS) {
      return res.status(403).json({ message: "❌ You are outside the company area" });
    }

    const now = getLocalTime();
    const day = getLocalDay();
    if (day === 0 || day === 6) return res.status(400).json({ message: "No attendance on weekends." });
    if (now < "18:00:00" || now > "23:45:00") return res.status(400).json({ message: "Check-out allowed 18:00–23:45 only." });

    const today = getLocalDate();

    await pool.query(
      `UPDATE attendance SET check_out_time = ? WHERE numerical_id = ? AND date = ?`,
      [now, numerical_id, today]
    );

    res.json({ message: "✅ Check-out successful." });
  } catch (err) {
    console.error("❌ Check-out error:", err);
    res.status(500).json({ message: "Check-out failed" });
  }
};

// ----------------------------------------
// Get attendance by employee
// ----------------------------------------
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { numerical_id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM attendance WHERE numerical_id = ? ORDER BY date DESC`,
      [numerical_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};
