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

// ✅ CORS
const allowedOrigins = [
  "https://gilitu.org",
  "http://gilitu.org",
  "http://localhost:5173"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors()); // Preflight

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
