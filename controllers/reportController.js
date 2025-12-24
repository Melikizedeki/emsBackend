// controllers/reportsController.js
import pool from "../configs/db.js"; // mysql2/promise

// ======================================================
// 🧠 HELPER FUNCTIONS
// ======================================================

// Attendance score based on status
const getAttendanceScore = (status) => {
  if (!status) return 0;
  status = status.toLowerCase();
  if (status === "present") return 100;
  if (status === "late") return 50;
  return 0; // absent or others
};

// Punctuality score (30-minute decay windows only)
const getPunctualityScore = (checkInTime) => {
  if (!checkInTime) return 0;

  const [h, m, s] = checkInTime.split(":").map(Number);
  const seconds = h * 3600 + m * 60 + s;

  // -------- DAY SHIFT (07:30 - 08:00) --------
  const dayStart = 7 * 3600 + 30 * 60; // 07:30
  const dayEnd = 8 * 3600;             // 08:00
  if (seconds >= dayStart && seconds <= dayEnd) {
    return Math.round(((dayEnd - seconds) / (dayEnd - dayStart)) * 100);
  }

  // -------- NIGHT SHIFT (19:30 - 20:00) --------
  const nightStart = 19 * 3600 + 30 * 60; // 19:30
  const nightEnd = 20 * 3600;             // 20:00
  if (seconds >= nightStart && seconds <= nightEnd) {
    return Math.round(((nightEnd - seconds) / (nightEnd - nightStart)) * 100);
  }

  // Outside punctuality windows
  return 0;
};

// ======================================================
// 📊 PERFORMANCE REPORT
// ======================================================
export const getPerformanceReport = async (req, res) => {
  try {
    const { year, month, period, date, holidays } = req.query;

    if (!year && !date) {
      return res.status(400).json({ error: "Year or date is required" });
    }

    const holidayList = holidays ? holidays.split(",").map(h => h.trim()) : [];

    // --------------------------------------------------
    // 📅 Determine reporting period
    // --------------------------------------------------
    let startDate, endDate;

    if (date) {
      startDate = date;
      endDate = date;
    } else if (period === "first") {
      startDate = `${year}-01-01`;
      endDate = `${year}-06-30`;
    } else if (period === "second") {
      startDate = `${year}-07-01`;
      endDate = `${year}-12-31`;
    } else if (period === "month" && month) {
      const m = month.toString().padStart(2, "0");
      startDate = `${year}-${m}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${m}-${lastDay}`;
    } else {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    // --------------------------------------------------
    // 👥 Fetch employees + attendance (exclude admin and field)
    // --------------------------------------------------
    const sql = `
      SELECT 
        e.id AS emp_id,
        e.employee_id,
        e.name,
        e.role,
        DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
        a.status,
        TIME_FORMAT(a.check_in_time, '%H:%i:%s') AS check_in_time
      FROM employee e
      LEFT JOIN attendance a 
        ON e.id = a.numerical_id AND a.date BETWEEN ? AND ?
      WHERE e.role NOT IN ('admin', 'field')
      ORDER BY e.name ASC
    `;

    const [rows] = await pool.query(sql, [startDate, endDate]);
    if (rows.length === 0) return res.json([]);

    // --------------------------------------------------
    // 📦 Group by employee
    // --------------------------------------------------
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.employee_id]) {
        grouped[r.employee_id] = { name: r.name, role: r.role, records: {} };
      }
      if (r.date) {
        grouped[r.employee_id].records[r.date] = r;
      }
    });

    // --------------------------------------------------
    // 🗓️ Build working days (exclude Sundays + holidays)
    // --------------------------------------------------
    const workingDays = [];
    if (date) {
      workingDays.push(date);
    } else {
      const d = new Date(startDate);
      const end = new Date(endDate);
      while (d <= end) {
        const ds = d.toISOString().split("T")[0];
        const day = d.getDay(); // 0 = Sunday
        if (day !== 0 && !holidayList.includes(ds)) {
          workingDays.push(ds);
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // --------------------------------------------------
    // 🧮 Calculate performance
    // --------------------------------------------------
    const report = Object.keys(grouped).map(empId => {
      const emp = grouped[empId];
      const recs = emp.records;
      let attendanceTotal = 0;
      let punctualityTotal = 0;
      let daysCount = 0;

      workingDays.forEach(d => {
        const rec = recs[d];
        attendanceTotal += rec ? getAttendanceScore(rec.status) : 0;
        punctualityTotal += rec ? getPunctualityScore(rec.check_in_time) : 0;
        daysCount++;
      });

      const attendanceRate = daysCount ? Math.round(attendanceTotal / daysCount) : 0;
      const punctualityRate = daysCount ? Math.round(punctualityTotal / daysCount) : 0;
      const performance = Math.round((attendanceRate + punctualityRate) / 2);

      let remarks = "Needs Improvement";
      if (performance >= 90) remarks = "Excellent";
      else if (performance >= 75) remarks = "Good";
      else if (performance >= 60) remarks = "Average";

      return {
        employee_id: empId,
        name: emp.name,
        role: emp.role,
        attendance_rate: attendanceRate,
        punctuality_rate: punctualityRate,
        performance,
        remarks,
        records: recs
      };
    });

    res.json(report);

  } catch (err) {
    console.error("❌ Performance report error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ======================================================
// 💰 PAYROLL REPORT (UNCHANGED)
// ======================================================
export const getPayrollReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    let filter = "";

    if (year && month) {
      filter = `WHERE p.month='${year}-${month.toString().padStart(2, "0")}'`;
    } else if (year) {
      filter = `WHERE p.month LIKE '${year}-%'`;
    }

    const sql = `
      SELECT 
        e.employee_id, 
        e.name, 
        e.role, 
        p.month, 
        p.salary, 
        p.net_salary
      FROM payrolls p
      LEFT JOIN employee e ON p.numerical_id = e.id
      ${filter}
      ORDER BY p.month DESC
    `;

    const [rows] = await pool.query(sql);
    res.json(rows);

  } catch (err) {
    console.error("❌ Payroll report error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
