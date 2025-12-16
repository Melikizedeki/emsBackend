// controllers/departmentController.js
import pool from "../configs/db.js";

// GET all departments with employee count
export const getDepartments = async (req, res) => {
  try {
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

    const [result] = await pool.query(sql);
    return res.json({ Status: true, Result: result });
  } catch (err) {
    console.error("Error fetching departments:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};

// GET employees by department code
export const getEmployeesByDepartment = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || code.trim() === "") {
      return res.status(400).json({ Status: false, Error: "Department code is required" });
    }

    const sql = `
      SELECT e.id, e.employee_id, e.name, e.email, e.phone
      FROM employee e
      WHERE e.department_code = ?
    `;

    const [result] = await pool.query(sql, [code]);
    return res.status(200).json({ Status: true, Result: result || [] });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ Status: false, Error: "Database error, please try again later." });
  }
};

// GET department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM departments WHERE id = ?";
    const [result] = await pool.query(sql, [id]);

    if (result.length === 0) return res.json({ Status: false, Error: "Department not found" });
    return res.json({ Status: true, Result: result[0] });
  } catch (err) {
    console.error("Error fetching department:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};

// UPDATE department by ID
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_code, department_name, head_of_department } = req.body;

    if (!department_code || !department_name) {
      return res.json({ Status: false, Error: "Department code and name are required" });
    }

    const sql = `
      UPDATE departments 
      SET department_code = ?, department_name = ?, head_of_department = ? 
      WHERE id = ?
    `;

    const [result] = await pool.query(sql, [department_code, department_name, head_of_department || null, id]);

    if (result.affectedRows === 0) return res.json({ Status: false, Error: "Department not found or not updated" });
    return res.json({ Status: true, Message: "Department updated successfully" });
  } catch (err) {
    console.error("Error updating department:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};

// ADD new department
export const addDepartment = async (req, res) => {
  try {
    const { department_code, department_name, head_of_department } = req.body;

    if (!department_code || !department_name) {
      return res.json({ Status: false, Error: "Department code and name are required" });
    }

    const sql = `
      INSERT INTO departments (department_code, department_name, head_of_department)
      VALUES (?, ?, ?)
    `;

    const [result] = await pool.query(sql, [department_code, department_name, head_of_department || null]);
    return res.json({ Status: true, Message: "Department added successfully" });
  } catch (err) {
    console.error("Error adding department:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};

// DELETE department by ID
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM departments WHERE id = ?";

    const [result] = await pool.query(sql, [id]);
    if (result.affectedRows === 0) return res.json({ Status: false, Error: "Department not found or already deleted" });

    return res.json({ Status: true, Message: "Department deleted successfully" });
  } catch (err) {
    console.error("Error deleting department:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};

// GET total number of departments
export const getTotalDepartments = async (req, res) => {
  try {
    const sql = "SELECT COUNT(*) AS total FROM departments";
    const [result] = await pool.query(sql);
    return res.json({ Status: true, total: result[0].total });
  } catch (err) {
    console.error("Error fetching department count:", err.message);
    return res.json({ Status: false, Error: err.message });
  }
};
