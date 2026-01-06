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
import "./configs/cron.js";

dotenv.config();

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


const allowedOrigins = [
  "https://gilitu.org",
  "http://gilitu.org",
  "http://localhost:5173"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});



// ✅ Routes
app.use("/api/credential", userRouter);
app.use("/api", employeeRouter);
app.use("/api", departmentRouter);
app.use("/api", permissionsRouter);
app.use("/api", eventsRouter);
app.use("/api/events", eventPayRouter);            // event payments
app.use("/api/staff/events", eventPayStaffRouter); // staff events
app.use("/api", attendanceRouter);
app.use("/api/admin", adminAttendanceRouter);
app.use("/api/pay", payrollRouter);
app.use("/api/report", reportRouter);

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT);
