import db from "../configs/db.js";

// Create a permission request
export const createPermission = (req, res) => {
  const { employee_id, type, reason } = req.body;

  if (!employee_id || !type || !reason) {
    return res.json({ Status: false, Error: "All fields are required" });
  }

  const sql = `
    INSERT INTO permission (employee_id, type, reason)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [employee_id, type, reason], (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true, Message: "Permission request submitted" });
  });
};

// Get all permissions for a staff member
export const getAllStaffPermissions = (req, res) => {
  const { employee_id } = req.params; // ✅ matches route

  const sql = `
    SELECT id, employee_id, type AS permission_type, reason, status, admin_id, admin_comment, requested_on
    FROM permission
    WHERE employee_id = ?
    ORDER BY requested_on DESC
  `;

  db.query(sql, [employee_id], (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true, Result: result });
  });
};


export const getAllPermissions = (req, res) => {
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

// Approve or reject a permission
export const adminupdatePermissionStatus = (req, res) => {
  const { permissionId } = req.params;
  const { status, admin_comment, admin_id } = req.body;

  if (!status || !admin_id) {
    return res.json({ Status: false, Error: "Status and admin_id are required" });
  }

  const sql = `
    UPDATE permission
    SET status = ?, admin_comment = ?, admin_id = ?
    WHERE id = ?
  `;

  db.query(sql, [status, admin_comment || null, admin_id, permissionId], (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true, Message: "Permission status updated" });
  });
};

// Get total pending permissions
export const getPendingPermissionsCount = (req, res) => {
  const sql = "SELECT COUNT(*) AS total FROM permission WHERE status = 'Pending'";

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching pending permissions:", err.sqlMessage);
      return res.json({ Status: false, Error: err.sqlMessage });
    }
    return res.json({ Status: true, total: result[0].total });
  });
};
