// controllers/departmentController.js
import db from "../configs/db.js";

// GET all departments with employee count
export const getDepartments = (req, res) => {
  const sql = `
    SELECT 
      d.id,
      d.department_code AS code,
      d.department_name AS name,
      d.head_of_department AS head,
      IFNULL(emp_count.total, 0) AS employee_count
    FROM departments d
    LEFT JOIN (
      SELECT department_code, COUNT(*) AS total
      FROM employee
      GROUP BY department_code
    ) emp_count ON d.department_code = emp_count.department_code
    ORDER BY d.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching departments:", err.sqlMessage);
      return res.json({ Status: false, Error: err.sqlMessage });
    }
    return res.json({ Status: true, Result: result });
  });
};

// controllers/departmentController.js

// controllers/departmentController.js

export const getEmployeesByDepartment = (req, res) => {
  const { code } = req.params;

  // Validation
  if (!code || code.trim() === "") {
    return res.status(400).json({
      Status: false,
      Error: "Department code is required",
    });
  }

  const sql = `
    SELECT e.id, e.employee_id, e.name, e.email, e.phone
    FROM employee e
    WHERE e.department_code = ?
  `;

  db.query(sql, [code], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        Status: false,
        Error: "Database error, please try again later.",
      });
    }

    // Always return 200 with empty array if no employees found
    return res.status(200).json({
      Status: true,
      Result: result || [],
    });
  });
};



// Get department by ID
export const getDepartmentById = (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM departments WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.json({ Status: false, Error: err.message });
    if (result.length === 0)
      return res.json({ Status: false, Error: "Department not found" });

    return res.json({ Status: true, Result: result[0] });
  });
};

// Update department by ID
export const updateDepartment = (req, res) => {
  const { id } = req.params;
  const { department_code, department_name, head_of_department } = req.body;

  // Validation
  if (!department_code || !department_name) {
    return res.json({ Status: false, Error: "Department code and name are required" });
  }

  const sql = `
    UPDATE departments 
    SET department_code = ?, department_name = ?, head_of_department = ? 
    WHERE id = ?
  `;
  db.query(sql, [department_code, department_name, head_of_department || null, id], (err, result) => {
    if (err) return res.json({ Status: false, Error: err.message });
    if (result.affectedRows === 0)
      return res.json({ Status: false, Error: "Department not found or not updated" });

    return res.json({ Status: true, Message: "Department updated successfully" });
  });
};



// Add new department
export const addDepartment = (req, res) => {
  const { department_code, department_name, head_of_department } = req.body;

  // Validation
  if (!department_code || !department_name) {
    return res.json({
      Status: false,
      Error: "Department code and name are required",
    });
  }

  const sql = `
    INSERT INTO departments (department_code, department_name, head_of_department)
    VALUES (?, ?, ?)
  `;

  db.query(
    sql,
    [department_code, department_name, head_of_department || null],
    (err, result) => {
      if (err) return res.json({ Status: false, Error: err.message });

      return res.json({ Status: true, Message: "Department added successfully" });
    }
  );
};


// Delete a department by ID
export const deleteDepartment = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM departments WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) return res.json({ Status: false, Error: err.message });

    if (result.affectedRows === 0) {
      return res.json({ Status: false, Error: "Department not found or already deleted" });
    }

    return res.json({ Status: true, Message: "Department deleted successfully" });
  });
};

// Get total number of departments
export const getTotalDepartments = (req, res) => {
  const sql = "SELECT COUNT(*) AS total FROM departments";
  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching department count:", err.sqlMessage);
      return res.json({ Status: false, Error: err.sqlMessage });
    }
    return res.json({ Status: true, total: result[0].total });
  });
};
