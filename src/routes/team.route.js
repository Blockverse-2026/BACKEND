import { Router } from "express";
import { registerTeam } from "../controllers/team.controller.js";

const router = Router();

router.post("/register", registerTeam);

export default router;
