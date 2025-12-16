// controllers/employeeController.js
import pool from "../configs/db.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import ImageKit from "imagekit";
import bcrypt from "bcrypt";

// ================================
// Configure ImageKit
// ================================
const imagekit = new ImageKit({
  publicKey: "public_HcwJPztlUrEpxOmFdpStGYy3Olw=",
  privateKey: "private_wZOkjeh5BOMhgevlrgXDaNIzzhU=",
  urlEndpoint: "https://ik.imagekit.io/8slecodiar",
});

// ================================
// Configure Multer
// ================================
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// ================================
// Add Employee
// ================================
export const addEmployee = async (req, res) => {
  try {
    const {
      employee_id,
      name,
      email,
      phone,
      password,
      role,
      date_of_birth,
      current_address,
      permanent_address,
      bank_name,
      account_name,
      account_number,
      department_code,
      position,
      salary,
      date_of_join,
      date_of_leave,
      status,
    } = req.body;

    if (!name || !email || !password || !req.file) {
      return res.status(400).json({ Status: false, Error: "Missing required fields or image" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const imageResult = await imagekit.upload({
      file: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      fileName: req.file.originalname,
    });

    const sql = `
      INSERT INTO employee
      (employee_id, name, email, phone, password, role, date_of_birth,
        current_address, permanent_address, bank_name, account_name, account_number,
        department_code, position, salary, date_of_join, date_of_leave, status, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      employee_id,
      name,
      email,
      phone,
      hashedPassword,
      role,
      date_of_birth,
      current_address,
      permanent_address,
      bank_name,
      account_name,
      account_number,
      department_code,
      position,
      salary,
      date_of_join,
      date_of_leave,
      status,
      imageResult.url,
    ];

    const [result] = await pool.query(sql, values);

    const token = jwt.sign({ id: result.insertId, role }, "2018..GilituEnterprisesLimited", { expiresIn: "7d" });

    return res.json({
      Status: true,
      Message: "✅ Employee added successfully",
      EmployeeId: result.insertId,
      Image: imageResult.url,
      token,
    });
  } catch (err) {
    console.error("❌ Error adding employee:", err.message);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};

// ================================
// Get All Employees
// ================================
export const getEmployees = async (req, res) => {
  try {
    const sql = `
      SELECT 
        e.id, e.employee_id, e.name, e.email, e.password, e.role, e.phone, e.salary,
        e.date_of_birth, e.current_address, e.permanent_address, e.image, e.position,
        e.date_of_join, e.date_of_leave, e.status, e.bank_name, e.account_name,
        e.account_number, d.department_name AS department
      FROM employee e
      LEFT JOIN departments d ON e.department_code = d.department_code
      ORDER BY e.id ASC
    `;
    const [result] = await pool.query(sql);
    return res.json({ Status: true, Result: result });
  } catch (err) {
    console.error("Error fetching employees:", err.message);
    return res.status(500).json({ Status: false, Error: "Database error" });
  }
};

// ================================
// Get Employee by ID
// ================================
export const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "SELECT * FROM employee WHERE id = ?";
    const [result] = await pool.query(sql, [id]);

    if (result.length === 0) return res.status(404).json({ Status: false, Error: "Employee not found" });
    return res.json({ Status: true, Result: result[0] });
  } catch (err) {
    console.error("Error fetching employee:", err.message);
    return res.status(500).json({ Status: false, Error: "Database error" });
  }
};

// ================================
// Edit Employee
// ================================
export const editEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const [existingResult] = await pool.query("SELECT * FROM employee WHERE id = ?", [id]);
    const existingEmployee = existingResult[0];

    if (!existingEmployee) return res.status(404).json({ Status: false, Error: "Employee not found" });

    const {
      employee_id,
      name,
      email,
      phone,
      password,
      role,
      date_of_birth,
      current_address,
      permanent_address,
      bank_name,
      account_name,
      account_number,
      department_code,
      position,
      salary,
      date_of_join,
      date_of_leave,
      status,
    } = req.body;

    let hashedPassword = existingEmployee.password;
    let token = null;
    if (password && password.trim() !== "") {
      hashedPassword = await bcrypt.hash(password, 10);
      token = jwt.sign({ id, role: role || existingEmployee.role }, "2018..GilituEnterprisesLimited", { expiresIn: "7d" });
    }

    let imageUrl = existingEmployee.image;
    if (req.file) {
      const imageResult = await imagekit.upload({
        file: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        fileName: req.file.originalname,
      });
      imageUrl = imageResult.url;
    }

    const sql = `
      UPDATE employee
      SET employee_id=?, name=?, email=?, phone=?, password=?, role=?, date_of_birth=?, 
          current_address=?, permanent_address=?, bank_name=?, account_name=?, account_number=?, 
          department_code=?, position=?, salary=?, date_of_join=?, date_of_leave=?, status=?, image=?
      WHERE id=?
    `;

    const values = [
      employee_id || existingEmployee.employee_id,
      name || existingEmployee.name,
      email || existingEmployee.email,
      phone || existingEmployee.phone,
      hashedPassword,
      role || existingEmployee.role,
      date_of_birth || existingEmployee.date_of_birth,
      current_address || existingEmployee.current_address,
      permanent_address || existingEmployee.permanent_address,
      bank_name || existingEmployee.bank_name,
      account_name || existingEmployee.account_name,
      account_number || existingEmployee.account_number,
      department_code || existingEmployee.department_code,
      position || existingEmployee.position,
      salary || existingEmployee.salary,
      date_of_join || existingEmployee.date_of_join,
      date_of_leave || existingEmployee.date_of_leave,
      status || existingEmployee.status,
      imageUrl,
      id,
    ];

    await pool.query(sql, values);

    return res.json({
      Status: true,
      Message: "✅ Employee updated successfully",
      EmployeeId: id,
      Image: imageUrl,
      ...(token && { token }),
    });
  } catch (err) {
    console.error("❌ Error updating employee:", err.message);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};

// ================================
// Delete Employee
// ================================
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM employee WHERE id = ?";
    const [result] = await pool.query(sql, [id]);

    if (result.affectedRows === 0) return res.json({ Status: false, Error: "Employee not found" });
    return res.json({ Status: true, Message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Error deleting employee:", err.message);
    return res.status(500).json({ Status: false, Error: "Database error" });
  }
};

// ================================
// Get Employee by employee_id
// ================================
export const getEmployeeByCode = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const sql = "SELECT id AS employee_numeric_id, name FROM employee WHERE employee_id = ?";
    const [results] = await pool.query(sql, [employee_id]);

    if (results.length === 0) return res.status(404).json({ message: "Employee not found" });
    return res.json(results[0]);
  } catch (err) {
    console.error("Error fetching employee by code:", err.message);
    return res.status(500).json({ message: "Database error" });
  }
};

// ================================
// Get Current User
// ================================
export const getUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ Status: false, Error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, "2018..GilituEnterprisesLimited");
    const userId = decoded.id;

    const sql = "SELECT id, name, role, image FROM employee WHERE id = ?";
    const [results] = await pool.query(sql, [userId]);

    if (results.length === 0) return res.status(404).json({ Status: false, Error: "User not found" });

    return res.json({
      Status: true,
      id: results[0].id,
      name: results[0].name,
      role: results[0].role,
      photo: results[0].image,
    });
  } catch (err) {
    console.error("Error in getUser:", err.message);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};

// ================================
// Get Total Employees
// ================================
export const getTotalEmployees = async (req, res) => {
  try {
    const sql = "SELECT COUNT(*) AS total FROM employee";
    const [result] = await pool.query(sql);
    return res.json({ Status: true, total: result[0].total });
  } catch (err) {
    console.error("Error counting employees:", err.message);
    return res.status(500).json({ Status: false, Error: "Database error" });
  }
};

// ================================
// Change Password
// ================================
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) return res.status(400).json({ Status: false, Error: "Both current and new password are required" });

    const sqlSelect = "SELECT password FROM employee WHERE id = ?";
    const [employeeResult] = await pool.query(sqlSelect, [id]);
    if (employeeResult.length === 0) return res.status(404).json({ Status: false, Error: "Employee not found" });

    const match = await bcrypt.compare(currentPassword, employeeResult[0].password);
    if (!match) return res.status(401).json({ Status: false, Error: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const sqlUpdate = "UPDATE employee SET password = ? WHERE id = ?";
    await pool.query(sqlUpdate, [hashedPassword, id]);

    return res.json({ Status: true, Message: "Password updated successfully" });
  } catch (err) {
    console.error("Error changing password:", err.message);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};
