import express from "express";
import {
  login,
  logout

} from "../controllers/userController.js";

const router = express.Router();

// POST /admin/login
router.post("/login", login);
router.post("/logout", logout);


export { router as userRouter };

