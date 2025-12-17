// controllers/reportsController.js
import pool from "../configs/db.js"; // mysql2/promise

// ===================== HELPER FUNCTIONS =====================
const getAttendanceScore = (status) => {
  if (!status) return 0;
  status = status.toLowerCase();
  if (status === "present") return 100;
  if (status === "late") return 50;
  return 0; // absent or other statuses
};

const getPunctualityScore = (checkInTime) => {
  if (!checkInTime) return 0;

  const [h, m, s] = checkInTime.split(":").map(Number);
  const seconds = h * 3600 + m * 60 + s;

  const start = 7 * 3600; // 07:00
  const end = 8 * 3600;   // 08:00

  if (seconds <= start) return 100;
  if (seconds >= end) return 0;

  return Math.round(((end - seconds) / (end - start)) * 100);
};

// ===================== PERFORMANCE REPORT =====================
export const getPerformanceReport = async (req, res) => {
  try {
    const { year, month, period, date, holidays } = req.query;
    const holidayList = holidays ? holidays.split(",").map(h => h.trim()) : [];

    if (!year) return res.status(400).json({ error: "Year is required" });

    // === Determine reporting period ===
    let startDate, endDate;
    if (date) {
      // Daily report
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
      // Full year
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    // === Fetch employees & attendance ===
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
        ON e.id = a.numerical_id 
        AND a.date BETWEEN ? AND ?
      WHERE e.role IN ('staff', 'field')  -- exclude admin
      ORDER BY e.name ASC;
    `;
    const [results] = await pool.query(sql, [startDate, endDate]);

    // === Group records by employee ===
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.employee_id])
        grouped[r.employee_id] = { name: r.name, role: r.role, records: {} };
      if (r.date) grouped[r.employee_id].records[r.date] = r;
    });

    // === Generate working days (exclude Sundays & holidays) ===
    const workingDays = [];
    if (date) {
      // Daily report
      workingDays.push(date);
    } else {
      const d = new Date(startDate);
      const endD = new Date(endDate);
      while (d <= endD) {
        const ds = d.toISOString().split("T")[0];
        const day = d.getDay();
        if (day !== 0 && !holidayList.includes(ds)) workingDays.push(ds);
        d.setDate(d.getDate() + 1);
      }
    }

    if (Object.keys(grouped).length === 0) return res.json([]);

    // === Calculate performance for each employee ===
    const data = Object.keys(grouped).map(empId => {
      const emp = grouped[empId];
      const recs = emp.records;

      let attendanceTotal = 0;
      let punctualityTotal = 0;
      let daysCount = 0;

      workingDays.forEach(dateStr => {
        const rec = recs[dateStr];
        const attendanceScore = rec ? getAttendanceScore(rec.status) : 0;
        const punctualityScore = rec ? getPunctualityScore(rec.check_in_time) : 0;

        attendanceTotal += attendanceScore;
        punctualityTotal += punctualityScore;
        daysCount++;
      });

      const attendanceRate = daysCount ? Math.round(attendanceTotal / daysCount) : 0;
      const punctualityRate = daysCount ? Math.round(punctualityTotal / daysCount) : 0;
      const performance = Math.round((attendanceRate + punctualityRate) / 2);

      let remarks = "";
      if (performance >= 90) remarks = "Excellent";
      else if (performance >= 75) remarks = "Good";
      else if (performance >= 60) remarks = "Average";
      else remarks = "Needs Improvement";

      return {
        employee_id: empId,
        name: emp.name,
        role: emp.role,
        attendance_rate: attendanceRate,
        punctuality_rate: punctualityRate,
        performance,
        remarks,
        records: recs, // include daily records
      };
    });

    res.json(data);
  } catch (err) {
    console.error("❌ Error generating performance report:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ===================== PAYROLL REPORT =====================
export const getPayrollReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    let filter = "";

    if (year && month)
      filter = `WHERE p.month = '${year}-${month.toString().padStart(2,"0")}'`;
    else if (year)
      filter = `WHERE p.month LIKE '${year}-%'`;

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
      ORDER BY p.month DESC;
    `;

    const [results] = await pool.query(sql);
    res.json(results);
  } catch (err) {
    console.error("❌ Error generating payroll report:", err.message);
    res.status(500).json({ error: err.message });
  }
};
