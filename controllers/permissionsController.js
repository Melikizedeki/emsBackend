// controllers/permissionController.js
import pool from "../configs/db.js"; // mysql2/promise

// ================================
// Create a permission request
// ================================
export const createPermission = async (req, res) => {
  try {
    const { employee_id, type, reason } = req.body;

    if (!employee_id || !type || !reason) {
      return res.status(400).json({ Status: false, Error: "All fields are required" });
    }

    const sql = `
      INSERT INTO permission (employee_id, type, reason)
      VALUES (?, ?, ?)
    `;
    await pool.query(sql, [employee_id, type, reason]);

    res.json({ Status: true, Message: "Permission request submitted" });
  } catch (err) {
    console.error("❌ Error creating permission:", err.message);
    res.status(500).json({ Status: false, Error: err.message });
  }
};

// ✅ Make sure this exists exactly
export const admingetAllPermissions = (req, res) => {
  const sql = `
    SELECT p.id, p.employee_id, e.name AS employee_name, p.type AS permission_type, 
           p.reason, p.status, p.admin_id, p.admin_comment, p.requested_on
    FROM permission p
    JOIN employee e ON p.employee_id = e.id
    ORDER BY p.requested_on DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true, Result: result });
  });
};


// ================================
// Get all permissions for a specific staff member
// ================================
export const getAllStaffPermissions = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const sql = `
      SELECT id, employee_id, type AS permission_type, reason, status, admin_id, admin_comment, requested_on
      FROM permission
      WHERE employee_id = ?
      ORDER BY requested_on DESC
    `;

    const [result] = await pool.query(sql, [employee_id]);
    res.json({ Status: true, Result: result });
  } catch (err) {
    console.error("❌ Error fetching staff permissions:", err.message);
    res.status(500).json({ Status: false, Error: err.message });
  }
};

// ================================
// Get all permissions (admin view)
// ================================
export const getAllPermissions = async (req, res) => {
  try {
    const sql = `
      SELECT p.id, p.employee_id, e.name AS employee_name, p.type AS permission_type, 
             p.reason, p.status, p.admin_id, p.admin_comment, p.requested_on
      FROM permission p
      JOIN employee e ON p.employee_id = e.id
      ORDER BY p.requested_on DESC
    `;

    const [result] = await pool.query(sql);
    res.json({ Status: true, Result: result });
  } catch (err) {
    console.error("❌ Error fetching permissions:", err.message);
    res.status(500).json({ Status: false, Error: err.message });
  }
};

// ================================
// Admin approve/reject a permission
// ================================
export const adminupdatePermissionStatus = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const { status, admin_comment, admin_id } = req.body;

    if (!status || !admin_id) {
      return res.status(400).json({ Status: false, Error: "Status and admin_id are required" });
    }

    const sql = `
      UPDATE permission
      SET status = ?, admin_comment = ?, admin_id = ?
      WHERE id = ?
    `;
    await pool.query(sql, [status, admin_comment || null, admin_id, permissionId]);

    res.json({ Status: true, Message: "Permission status updated" });
  } catch (err) {
    console.error("❌ Error updating permission status:", err.message);
    res.status(500).json({ Status: false, Error: err.message });
  }
};

// ================================
// Get total pending permissions
// ================================
export const getPendingPermissionsCount = async (req, res) => {
  try {
    const sql = "SELECT COUNT(*) AS total FROM permission WHERE status = 'Pending'";
    const [result] = await pool.query(sql);
    res.json({ Status: true, total: result[0].total });
  } catch (err) {
    console.error("❌ Error fetching pending permissions:", err.message);
    res.status(500).json({ Status: false, Error: err.message });
  }
};
