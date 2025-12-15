import jwt from "jsonwebtoken";

// Middleware for normal users (Admin + Staff)
export const authUser = (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        return res.json({ success: false, message: "Not Authorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.id) {
            req.userId = decoded.id;   // attach userId to request
            req.role = decoded.role;   // also attach role
            next();
        } else {
            return res.json({ success: false, message: "Not Authorized" });
        }
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// Middleware for Admin only
export const authAdmin = (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        return res.json({ success: false, message: "Not Authorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role === "admin") {
            req.userId = decoded.id;
            req.role = decoded.role;
            next();
        } else {
            return res.json({ success: false, message: "Admins only" });
        }
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
