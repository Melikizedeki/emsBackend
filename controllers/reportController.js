import pool from "../configs/db.js";

// ================= PERFORMANCE =================
export const getPerformanceReport = async (req, res) => {
  try {
    const { year, month, period, date, holidays } = req.query;
    const holidayList = holidays ? holidays.split(",").map(h => h.trim()) : [];

    let startDate, endDate;

    // ✅ DAILY
    if (date) {
      startDate = date;
      endDate = date;
    }
    // MONTHLY
    else if (period === "month" && month) {
      const m = month.toString().padStart(2, "0");
      startDate = `${year}-${m}-01`;
      endDate = `${year}-${m}-${new Date(year, month, 0).getDate()}`;
    }
    // FULL YEAR
    else {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    const sql = `
      SELECT 
        e.employee_id,
        e.name,
        e.role,
        a.date,
        a.status,
        a.check_in_time
      FROM employee e
      LEFT JOIN attendance a 
        ON e.id = a.numerical_id
        AND a.date BETWEEN ? AND ?
      WHERE e.role IN ('staff','field')   -- ❌ NO ADMIN
      ORDER BY e.name;
    `;

    const [rows] = await pool.query(sql, [startDate, endDate]);

    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.employee_id])
        grouped[r.employee_id] = { ...r, records: [] };
      grouped[r.employee_id].records.push(r);
    });

    const data = Object.values(grouped).map(emp => {
      let attendance = 0;
      let punctuality = 0;

      emp.records.forEach(r => {
        if (r.status === "present") attendance += 1;
        if (r.check_in_time <= "08:00:00") punctuality += 1;
      });

      const days = emp.records.length || 1;
      const attendance_rate = Math.round((attendance / days) * 100);
      const punctuality_rate = Math.round((punctuality / days) * 100);
      const performance = Math.round((attendance_rate + punctuality_rate) / 2);

      return {
        employee_id: emp.employee_id,
        name: emp.name,
        role: emp.role,
        attendance_rate,
        punctuality_rate,
        performance,
        remarks:
          performance >= 90 ? "Excellent" :
          performance >= 75 ? "Good" :
          performance >= 60 ? "Average" :
          "Needs Improvement",
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= PAYROLL (UNTOUCHED) =================
export const getPayrollReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    let filter = "";

    if (year && month)
      filter = `WHERE p.month='${year}-${month.toString().padStart(2,"0")}'`;

    const sql = `
      SELECT e.employee_id, e.name, p.month, p.salary, p.net_salary
      FROM payrolls p
      LEFT JOIN employee e ON p.numerical_id=e.id
      ${filter}
    `;

    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
