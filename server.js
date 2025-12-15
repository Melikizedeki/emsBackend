import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv"; 
import { userRouter } from "./routes/userRoute.js";
import { employeeRouter } from "./routes/employeeRoute.js";
import { departmentRouter } from "./routes/departmentRoute.js";
import { permissionsRouter } from "./routes/permissionRoute.js";
import { eventsRouter } from "./routes/eventsRoute.js";
import { eventPayRouter } from "./routes/eventPayRoute.js";
import { eventPayStaffRouter } from "./routes/eventPayStaffRoute.js";
import { attendanceRouter } from "./routes/staffAttendanceRoute.js";
import { adminAttendanceRouter } from "./routes/adminAttendanceRoutes.js";
import { payrollRouter } from "./routes/payrollRoute.js";
import { reportRouter } from "./routes/reportRoute.js";
import "./configs/cron.js"; // <--- This runs your cron jobs automatically
// ✅ Load env variables
dotenv.config();

// ✅ Import cron jobs
//setupCronJobs();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || ["http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// ✅ Routes
app.use("/api", userRouter);
app.use("/api", employeeRouter);
app.use("/api", departmentRouter);
app.use("/api", permissionsRouter);
app.use("/api/", eventsRouter);
app.use("/api/events", eventPayRouter);
app.use("/api/staff/events", eventPayStaffRouter);
app.use("/api", attendanceRouter);
app.use("/api/admin", adminAttendanceRouter);
app.use("/api/pay", payrollRouter);
app.use("/api/report", reportRouter);

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log removed for production
});
