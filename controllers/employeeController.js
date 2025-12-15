import db from "../configs/db.js"; 
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
      salary, // ✅ added salary
      date_of_join,
      date_of_leave,
      status,
    } = req.body;

    if (!name || !email || !password || !req.file) {
      return res.status(400).json({
        Status: false,
        Error: "Missing required fields or image",
      });
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
      salary, // ✅ include salary value
      date_of_join,
      date_of_leave,
      status,
      imageResult.url,
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("❌ Error adding employee:", err);
        return res.status(500).json({ Status: false, Error: "Database Error" });
      }

      const token = jwt.sign(
        { id: result.insertId, role },
        "2018..GilituEnterprisesLimited",
        { expiresIn: "7d" }
      );

      return res.json({
        Status: true,
        Message: "✅ Employee added successfully",
        EmployeeId: result.insertId,
        Image: imageResult.url,
        token,
      });
    });
  } catch (err) {
    console.error("❌ Error uploading image:", err);
    return res.status(500).json({ Status: false, Error: "Image upload failed" });
  }
};

// ================================
// Get All Employees
// ================================
export const getEmployees = (req, res) => {
  const sql = `
    SELECT 
      e.id,
      e.employee_id,
      e.name,
      e.email,
      e.password,
      e.role,
      e.phone,
      e.salary,          -- ✅ include salary here
      e.date_of_birth,
      e.current_address,
      e.permanent_address,
      e.image,
      e.position,
      e.date_of_join,
      e.date_of_leave,
      e.status,
      e.bank_name,
      e.account_name,
      e.account_number,
      d.department_name AS department
    FROM employee e
    LEFT JOIN departments d ON e.department_code = d.department_code
    ORDER BY e.id ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching employees:", err);
      return res.json({ Status: false, Error: "Query Error" });
    }
    return res.json({ Status: true, Result: result });
  });
};

// ================================
// Get Employee by ID
// ================================
export const getEmployeeById = (req, res) => {
  const id = req.params.id;
  const query = "SELECT * FROM employee WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Database error" });
    if (result.length === 0) return res.status(404).json({ Status: false, Error: "Employee not found" });
    res.json({ Status: true, Result: result[0] });
  });
};

// ================================
// Edit Employee
// ================================
export const editEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const existingEmployee = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM employee WHERE id = ?", [id], (err, result) => {
        if (err) return reject(err);
        if (!result || result.length === 0) return resolve(null);
        resolve(result[0]);
      });
    });

    if (!existingEmployee) {
      return res.status(404).json({ Status: false, Error: "Employee not found" });
    }

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
      salary, // ✅ salary added here
      date_of_join,
      date_of_leave,
      status,
    } = req.body;

    let hashedPassword = existingEmployee.password;
    let passwordChanged = false;
    if (password && password.trim() !== "") {
      hashedPassword = await bcrypt.hash(password, 10);
      passwordChanged = true;
    }

    let imageUrl = existingEmployee.image;
    if (req.file) {
      const imageResult = await imagekit.upload({
        file: `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
        fileName: req.file.originalname,
      });
      imageUrl = imageResult.url;
    }

    const updatedValues = {
      employee_id: employee_id || existingEmployee.employee_id,
      name: name || existingEmployee.name,
      email: email || existingEmployee.email,
      phone: phone || existingEmployee.phone,
      password: hashedPassword,
      role: role || existingEmployee.role,
      date_of_birth: date_of_birth || existingEmployee.date_of_birth,
      current_address: current_address || existingEmployee.current_address,
      permanent_address: permanent_address || existingEmployee.permanent_address,
      bank_name: bank_name || existingEmployee.bank_name,
      account_name: account_name || existingEmployee.account_name,
      account_number: account_number || existingEmployee.account_number,
      department_code: department_code || existingEmployee.department_code,
      position: position || existingEmployee.position,
      salary: salary || existingEmployee.salary, // ✅ include salary
      date_of_join: date_of_join || existingEmployee.date_of_join,
      date_of_leave: date_of_leave || existingEmployee.date_of_leave,
      status: status || existingEmployee.status,
      image: imageUrl,
    };

    const sql = ` 
      UPDATE employee
      SET employee_id=?, name=?, email=?, phone=?, password=?, role=?, date_of_birth=?, 
          current_address=?, permanent_address=?, bank_name=?, account_name=?, account_number=?, 
          department_code=?, position=?, salary=?, date_of_join=?, date_of_leave=?, status=?, image=?
      WHERE id=?
    `;

    const values = [
      updatedValues.employee_id,
      updatedValues.name,
      updatedValues.email,
      updatedValues.phone,
      updatedValues.password,
      updatedValues.role,
      updatedValues.date_of_birth,
      updatedValues.current_address,
      updatedValues.permanent_address,
      updatedValues.bank_name,
      updatedValues.account_name,
      updatedValues.account_number,
      updatedValues.department_code,
      updatedValues.position,
      updatedValues.salary, // ✅ salary
      updatedValues.date_of_join,
      updatedValues.date_of_leave,
      updatedValues.status,
      updatedValues.image,
      id,
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error("❌ Error updating employee:", err);
        return res.status(500).json({ Status: false, Error: "Database Error" });
      }

      let token = null;
      if (passwordChanged || updatedValues.role !== existingEmployee.role) {
        token = jwt.sign(
          { id, role: updatedValues.role },
          "2018..GilituEnterprisesLimited",
          { expiresIn: "7d" }
        );
      }

      return res.json({
        Status: true,
        Message: "✅ Employee updated successfully",
        EmployeeId: id,
        Image: updatedValues.image,
        ...(token && { token }),
      });
    });
  } catch (err) {
    console.error("❌ Error in editEmployee:", err);
    return res.status(500).json({ Status: false, Error: "Server Error" });
  }
};

// ================================
// Delete Employee
// ================================
export const deleteEmployee = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM employee WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Delete employee error:", err);
      return res.json({ Status: false, Error: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.json({ Status: false, Error: "Employee not found" });
    }

    return res.json({ Status: true, Message: "Employee deleted successfully" });
  });
};

// ================================
// Get Employee by employee_id
// ================================
export const getEmployeeByCode = (req, res) => {
  const { employee_id } = req.params;

  const sql = `
    SELECT id AS employee_numeric_id, name 
    FROM employee 
    WHERE employee_id = ?
  `;

  db.query(sql, [employee_id], (err, results) => {
    if (err) {
      console.error("Error fetching employee:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(results[0]);
  });
};

// ================================
// Get User (current logged-in)
// ================================
export const getUser = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ Status: false, Error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, "2018..GilituEnterprisesLimited", (err, decoded) => {
      if (err) {
        return res.status(401).json({ Status: false, Error: "Invalid token" });
      }

      const userId = decoded.id;

      const sql = `SELECT id, name, role, image FROM employee WHERE id = ?`;
      db.query(sql, [userId], (err, results) => {
        if (err) {
          console.error("❌ getUser query error:", err);
          return res.status(500).json({ Status: false, Error: "Database error" });
        }

        if (results.length === 0) {
          return res.status(404).json({ Status: false, Error: "User not found" });
        }

        return res.json({
          Status: true,
          id: results[0].id,
          name: results[0].name,
          role: results[0].role,
          photo: results[0].image, // <-- very important
        });
      });
    });
  } catch (error) {
    console.error("❌ getUser error:", error);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};

// ================================
// Get Total Employees
// ================================
export const getTotalEmployees = (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM employee`;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error counting employees:", err);
      return res.status(500).json({ Status: false, Error: "Database error" });
    }

    return res.json({ Status: true, total: result[0].total });
  });
};


//change password
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params; // employee numeric id
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ Status: false, Error: "Both current and new password are required" });
    }

    // 1️⃣ Fetch the employee from DB
    const employee = await new Promise((resolve, reject) => {
      const sql = "SELECT password FROM employee WHERE id = ?";
      db.query(sql, [id], (err, result) => {
        if (err) return reject(err);
        if (result.length === 0) return resolve(null);
        resolve(result[0]);
      });
    });

    if (!employee) {
      return res.status(404).json({ Status: false, Error: "Employee not found" });
    }

    // 2️⃣ Verify current password
    const match = await bcrypt.compare(currentPassword, employee.password);
    if (!match) {
      return res.status(401).json({ Status: false, Error: "Current password is incorrect" });
    }

    // 3️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4️⃣ Update password in DB
    await new Promise((resolve, reject) => {
      const sql = "UPDATE employee SET password = ? WHERE id = ?";
      db.query(sql, [hashedPassword, id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.json({ Status: true, Message: "Password updated successfully" });
  } catch (error) {
    console.error("❌ Change password error:", error);
    return res.status(500).json({ Status: false, Error: "Server error" });
  }
};
