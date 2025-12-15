import express from "express";
import {
  initializeDailyAttendance,
  getAttendanceByDate,
  getAttendanceSummary,
} from "../controllers/adminAttendanceController.js";

const router = express.Router();

router.post("/attendance/initialize", initializeDailyAttendance);
router.get("/attendance/date/:date", getAttendanceByDate);
router.get("/attendance/summary/:date", getAttendanceSummary);

export  {router as adminAttendanceRouter};
