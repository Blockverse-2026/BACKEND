import express from "express";
import Team from "../models/team.model.js";

const router = express.Router();

// Get leaderboard with rank
router.get("/", async (req, res) => {
  try {
    const teams = await Team.find()
      .sort({ totalPoints: -1, createdAt: 1 }) // High score first
      .select("teamId totalPoints");

    // Add rank
    const leaderboard = teams.map((team, index) => ({
      rank: index + 1,
      teamId: team.teamId,
      totalPoints: team.totalPoints,
    }));

    res.json({
      success: true,
      leaderboard,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;
