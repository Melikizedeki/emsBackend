import pool from "../configs/db.js";

/* ==========================
   📍 GEOFENCE
========================== */
const CENTER = { lat: -4.822958, lng: 34.76901956 };
const RADIUS = 1000;

const haversine = (a, b, c, d) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(c - a);
  const dLon = toRad(d - b);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) *
      Math.cos(toRad(c)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/* ==========================
   🕒 TIME HELPERS
========================== */
const tzNow = () =>
  new Date(new Date().toLocaleString("en-US", {
    timeZone: "Africa/Dar_es_Salaam",
  }));

const timeToSec = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

const today = () => tzNow().toISOString().split("T")[0];
const yesterday = () => {
  const d = tzNow();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

const nowTime = () => tzNow().toTimeString().slice(0, 8);
const weekday = () =>
  ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][
    tzNow().getDay()
  ];

/* ==========================
   ✅ CHECK-IN
========================== */
export const checkIn = async (req, res) => {
  const { numerical_id, latitude, longitude } = req.body;

  const dist = haversine(
    latitude,
    longitude,
    CENTER.lat,
    CENTER.lng
  );

  if (dist > RADIUS)
    return res.status(403).json({ message: "Outside company area" });

  const time = nowTime();
  const sec = timeToSec(time);
  let status = null;

  // Day shift
  if (sec >= 7.5 * 3600 && sec <= 9 * 3600)
    status = sec <= 8 * 3600 ? "present" : "late";

  // Night shift
  if (sec >= 19.5 * 3600 && sec <= 21 * 3600)
    status = sec <= 20 * 3600 ? "present" : "late";

  if (!status)
    return res.status(403).json({ message: "Check-in not allowed now" });

  await pool.query(
    `UPDATE attendance SET check_in_time=?, status=?
     WHERE numerical_id=? AND date=?`,
    [time, status, numerical_id, today()]
  );

  res.json({ message: "Check-in successful" });
};

/* ==========================
   ✅ CHECK-OUT
========================== */
export const checkOut = async (req, res) => {
  const { numerical_id, latitude, longitude, role = "staff" } = req.body;

  const dist = haversine(latitude, longitude, CENTER.lat, CENTER.lng);
  if (dist > RADIUS)
    return res.status(403).json({ message: "Outside company area" });

  const nowSec = timeToSec(nowTime());
  const day = weekday();

  const [[todayRow]] = await pool.query(
    `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
    [numerical_id, today()]
  );

  const [[yRow]] = await pool.query(
    `SELECT check_in_time FROM attendance WHERE numerical_id=? AND date=?`,
    [numerical_id, yesterday()]
  );

  let checkIn = todayRow?.check_in_time;
  let dateToUpdate = today();

  if (!checkIn && yRow?.check_in_time) {
    checkIn = yRow.check_in_time;
    dateToUpdate = yesterday();
  }

  if (!checkIn)
    return res.status(404).json({ message: "No active shift" });

  const ciSec = timeToSec(checkIn);

  // 🔴 Wednesday staff rule
  if (day === "Wednesday" && role === "staff" && nowSec < 9 * 3600) {
    return res.status(403).json({
      message: "Staff can checkout after 09:00 on Wednesday",
    });
  }

  // Day shift checkout
  if (ciSec >= 7.5 * 3600 && ciSec <= 9 * 3600) {
    if (nowSec < 18 * 3600 || nowSec > 18 * 3600 + 59 * 60) {
      return res.status(403).json({
        message: "Day shift checkout allowed 18:00–18:59",
      });
    }
  }

  // Night shift checkout
  if (ciSec >= 19.5 * 3600 && ciSec <= 21 * 3600) {
    if (nowSec < 6 * 3600 || nowSec > 7 * 3600 + 55 * 60) {
      return res.status(403).json({
        message: "Night shift checkout allowed 06:00–07:55",
      });
    }
    dateToUpdate = yesterday();
  }

  await pool.query(
    `UPDATE attendance SET check_out_time=?
     WHERE numerical_id=? AND date=?`,
    [nowTime(), numerical_id, dateToUpdate]
  );

  res.json({ message: "Check-out successful" });
};

/* ==========================
   📄 HISTORY
========================== */
export const getAttendanceByEmployee = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT date, check_in_time, check_out_time, status
     FROM attendance WHERE numerical_id=? ORDER BY date DESC`,
    [req.params.numerical_id]
  );
  res.json(rows);
};
