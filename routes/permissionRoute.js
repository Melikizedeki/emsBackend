import express from "express";
import {
  createPermission,
  getAllStaffPermissions,
  getAllPermissions,
  adminupdatePermissionStatus,
  getPendingPermissionsCount
} from "../controllers/permissionsController.js";

const router = express.Router();

// Staff routes
router.post("/permissions", createPermission);
router.get("/permissions/staff/:employee_id", getAllStaffPermissions);

// Admin routes
router.get("/permissions/all", getAllPermissions); // ✅ corrected
router.put("/permissions/:permissionId", adminupdatePermissionStatus); // Approve/reject
router.get("/pending-count", getPendingPermissionsCount);

export { router as permissionsRouter };
