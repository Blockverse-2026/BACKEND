import express from "express";
import {
  initRound3,
  submitRound3Answer,
} from "../controllers/round3.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/init", protect, initRound3);
router.post("/submit", protect, submitRound3Answer);

export default router;
