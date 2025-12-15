import express from "express";
import {
  checkIn,
  checkOut,
  getAttendanceByEmployee,
} from "../controllers/staffAttendanceController.js";

const router = express.Router();

router.post("/attendance/checkin", checkIn);
router.post("/attendance/checkout", checkOut);
router.get("/attendance/:numerical_id", getAttendanceByEmployee);

export { router as attendanceRouter };
