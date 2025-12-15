import express from "express";
import { getDepartments,getEmployeesByDepartment,getDepartmentById,updateDepartment,addDepartment,deleteDepartment,getTotalDepartments } from "../controllers/departmentController.js";

const router = express.Router();

// ================================
// Get all employees
// GET /api/employees
// ================================
router.get("/departments", getDepartments);
router.get("/departments/:code", getEmployeesByDepartment);
router.get("/departments/by-id/:id", getDepartmentById);
router.put("/departments/:id", updateDepartment);
router.post("/departments", addDepartment);
router.delete("/delete_departments/:id", deleteDepartment);
router.get("/total", getTotalDepartments);


export { router as departmentRouter };
