import db from "../configs/db.js";

// ===================== PERFORMANCE REPORT =====================
export const getPerformanceReport = (req, res) => {
  const { year, month, period, holidays } = req.query;
  const holidayList = holidays ? holidays.split(",").map(h => h.trim()) : [];

  if (!year) return res.status(400).json({ error: "Year is required" });

  let startDate, endDate;

  // === Determine reporting period ===
  if (period === "first") {
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

  // === Fetch employees & attendance records ===
  const query = `
    SELECT 
      e.id AS emp_id,
      e.employee_id,
      e.name,
      e.role,  -- ADDED
      DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
      a.status,
      TIME_FORMAT(a.check_in_time, '%H:%i:%s') AS check_in_time
    FROM employee e
    LEFT JOIN attendance a 
      ON e.id = a.numerical_id 
      AND a.date BETWEEN ? AND ?
    ORDER BY e.name ASC;
  `;

  db.query(query, [startDate, endDate], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // === Group data by employee ===
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.employee_id])
        grouped[r.employee_id] = { 
          name: r.name, 
          role: r.role,   // ADDED
          records: {} 
        };

      if (r.date) grouped[r.employee_id].records[r.date] = r;
    });

    // === Generate working days (exclude Sundays & holidays) ===
    const workingDays = [];
    const d = new Date(startDate);
    const end = new Date(endDate);

    while (d <= end) {
      const ds = d.toISOString().split("T")[0];
      const day = d.getDay();
      if (day !== 0 && !holidayList.includes(ds)) workingDays.push(ds);
      d.setDate(d.getDate() + 1);
    }

    if (Object.keys(grouped).length === 0) return res.json([]);

    const data = Object.keys(grouped).map(empId => {
      const emp = grouped[empId];
      const recs = emp.records;

      let attendancePoints = 0;
      let punctualityPoints = 0;

      workingDays.forEach(dateStr => {
        const rec = recs[dateStr];
        if (rec) {
          const status = rec.status?.toLowerCase();

          // === Attendance weighting ===
          if (status === "present") attendancePoints += 1;
          else if (status === "late") attendancePoints += 0.5;

          // === Punctuality calculation ===
          if (rec.check_in_time && (status === "present" || status === "late")) {
            const [h, m, s] = rec.check_in_time.split(":").map(Number);
            const seconds = h * 3600 + m * 60 + s;
            const start = 7 * 3600; // 7:00 AM
            const limit = 8 * 3600; // 8:00 AM

            if (seconds <= start) punctualityPoints += 100;
            else if (seconds <= limit) {
              punctualityPoints += Math.round((1 - (seconds - start) / (limit - start)) * 100);
            }
          }
        }
      });

      const totalWorkingDays = workingDays.length;
      const attendanceRate = totalWorkingDays
        ? Math.round((attendancePoints / totalWorkingDays) * 100)
        : 0;

      const punctualityRate = totalWorkingDays
        ? Math.round(punctualityPoints / totalWorkingDays)
        : 0;

      const performance = Math.round((attendanceRate + punctualityRate) / 2);

      let remarks = "";
      if (performance >= 90) remarks = "Excellent";
      else if (performance >= 75) remarks = "Good";
      else if (performance >= 60) remarks = "Average";
      else remarks = "Needs Improvement";

      return {
        employee_id: empId,
        name: emp.name,
        role: emp.role,  // ADDED
        attendance_rate: attendanceRate,
        punctuality_rate: punctualityRate,
        performance,
        remarks,
      };
    });

    res.json(data);
  });
};

// ===================== PAYROLL REPORT =====================
export const getPayrollReport = (req, res) => {
  const { year, month } = req.query;
  let filter = "";

  if (year && month)
    filter = `WHERE p.month = '${year}-${month.toString().padStart(2,"0")}'`;
  else if (year)
    filter = `WHERE p.month LIKE '${year}-%'`;

  const query = `
    SELECT 
      e.employee_id, 
      e.name,
      e.role,      -- ADDED
      p.month, 
      p.salary, 
      p.net_salary
    FROM payrolls p
    LEFT JOIN employee e ON p.numerical_id = e.id
    ${filter}
    ORDER BY p.month DESC;
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
