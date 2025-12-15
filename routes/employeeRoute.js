import express from "express";
import { getEmployees, addEmployee,getEmployeeByCode,upload,getEmployeeById,editEmployee,getUser,deleteEmployee,getTotalEmployees,changePassword } from "../controllers/employeeController.js";

const router = express.Router();

// ================================
// Get all employees
// GET /api/employees
// ================================
router.get("/employees", getEmployees);
// GET single employee by id

router.get("/employee/:id", getEmployeeById);
router.put("/employee/:id", upload.single("image"), editEmployee);
router.get("/user", getUser);
router.delete("/employee/:id", deleteEmployee);
router.get("/employee/code/:employee_id", getEmployeeByCode);
router.get("/employees/total", getTotalEmployees);

router.put("/change-password/:id", changePassword);





// POST /api/add_employee
// ================================
router.post("/add_employee", upload.single("image"), addEmployee);

// ================================
// Delete employee by ID
// DELETE /api/employee/:id
// ================================


export { router as employeeRouter };
