import jwt from "jsonwebtoken";
import pool from "../configs/db.js";
import bcrypt from "bcrypt";

// --- LOGIN ---
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        loginStatus: false,
        Error: "Email and password are required",
      });
    }

    const sql = "SELECT * FROM employee WHERE email = ?";
    const [results] = await pool.query(sql, [email]);

    if (results.length === 0) {
      return res.json({
        loginStatus: false,
        Error: "Invalid email or password",
      });
    }

    const user = results[0];

    // ✅ Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({
        loginStatus: false,
        Error: "Invalid email or password",
      });
    }

    // ✅ Create JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "2018..GilituEnterprisesLimited",
      { expiresIn: "7d" }
    );

    // ✅ Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      loginStatus: true,
      role: user.role,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).json({
      loginStatus: false,
      Error: "Database error",
    });
  }
};

// --- LOGOUT ---
export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
};
