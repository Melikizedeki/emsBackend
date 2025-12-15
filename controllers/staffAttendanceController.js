import db from "../configs/db.js";

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

const getTzDateTime = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + 3 * 3600000);
  return {
    date: local.toISOString().split("T")[0],
    time: local.toTimeString().split(" ")[0],
  };
};

// ✅ Check-in
export const checkIn = (req, res) => {
  const { numerical_id, latitude, longitude } = req.body;
  if (!latitude || !longitude)
    return res.status(400).json({ message: "Coordinates required" });

  const distance = haversineDistance(latitude, longitude, GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng);
  if (distance > GEOFENCE_RADIUS)
    return res.status(400).json({ message: "Outside company area" });

  const { date, time } = getTzDateTime();

  let status = "pending";
  // Day morning windows
  if (time >= "07:00:00" && time <= "07:59:59") status = "present";
  else if (time >= "08:00:00" && time <= "08:59:59") status = "late";
  else if (time >= "09:00:00" && time <= "17:59:59") status = "absent";
  // Night windows (19:30-20:59 present/late, absent 21:00-05:59)
  else if (time >= "19:30:00" && time <= "19:59:59") status = "present";
  else if (time >= "20:00:00" && time <= "20:59:59") status = "late";
  else if (time >= "21:00:00" || time <= "05:59:59") status = "absent";

  db.query("SELECT * FROM attendance WHERE numerical_id=? AND date=?", [numerical_id, date], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (rows.length > 0 && rows[0].check_in_time)
      return res.status(400).json({ message: "Check-in already done today" });

    if (rows.length > 0) {
      db.query(
        "UPDATE attendance SET check_in_time=?, status=? WHERE numerical_id=? AND date=?",
        [time, status, numerical_id, date],
        (err2) =>
          err2
            ? res.status(500).json({ message: "Update failed" })
            : res.json({ message: `Check-in ${status}`, time })
      );
    } else {
      db.query(
        "INSERT INTO attendance (numerical_id, date, check_in_time, status) VALUES (?, ?, ?, ?)",
        [numerical_id, date, time, status],
        (err2) =>
          err2
            ? res.status(500).json({ message: "Insert failed" })
            : res.json({ message: `Check-in ${status}`, time })
      );
    }
  });
};

// ✅ Check-out
export const checkOut = (req, res) => {
  const { numerical_id, latitude, longitude } = req.body;
  if (!latitude || !longitude)
    return res.status(400).json({ message: "Coordinates required" });

  const distance = haversineDistance(latitude, longitude, GEOFENCE_CENTER.lat, GEOFENCE_CENTER.lng);
  if (distance > GEOFENCE_RADIUS)
    return res.status(400).json({ message: "Outside company area" });

  const { date, time } = getTzDateTime();

  // Determine intended attendance date for checkout (night checkouts belong to previous date)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + 3 * 3600000);
  let attendanceDate = local.toISOString().split("T")[0];

  // Allowed checkout windows:
  // - Day shifts: 18:00-18:59 (same date)
  // - Night shifts: 06:00-06:59 (previous date)
  // - Saturday early checkout for staff: 15:00-15:59
  const isDayCheckout = time >= "18:00:00" && time <= "18:59:59";
  const isNightCheckout = time >= "06:00:00" && time <= "06:59:59";
  const isSatCheckout = time >= "15:00:00" && time <= "15:59:59" && local.getDay() === 6;

  if (isNightCheckout) {
    const y = new Date(local);
    y.setDate(y.getDate() - 1);
    attendanceDate = y.toISOString().split("T")[0];
  }

  if (!isDayCheckout && !isNightCheckout && !isSatCheckout) {
    return res.status(400).json({ message: "Check-out not allowed at this time" });
  }

  db.query("SELECT * FROM attendance WHERE numerical_id=? AND date=?", [numerical_id, attendanceDate], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (rows.length === 0 || !rows[0].check_in_time)
      return res.status(400).json({ message: "You must check-in first" });

    db.query(
      "UPDATE attendance SET check_out_time=? WHERE numerical_id=? AND date=?",
      [time, numerical_id, date],
      (err2) =>
        err2
          ? res.status(500).json({ message: "Check-out failed" })
          : res.json({ message: "Check-out successful", time })
    );
  });
};

// ✅ Get attendance by employee
export const getAttendanceByEmployee = (req, res) => {
  const { numerical_id } = req.params;
  db.query(
    "SELECT date, check_in_time, check_out_time, status FROM attendance WHERE numerical_id=? ORDER BY date DESC",
    [numerical_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json(rows);
    }
  );
};
