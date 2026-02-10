const ROUND3_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_MISTAKES_PER_BOMB = 2;

import Round3Question from "../models/round3/round3Question.model.js";
import Round3Progress from "../models/round3/round3Progress.model.js";
import Team from "../models/team.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { emitLeaderboard } from "../utils/emitLeaderboard.js";

/**
 * INIT ROUND 3
 */
export const initRound3 = asyncHandler(async (req, res) => {
  const teamId = req.teamId;

  if (!teamId) {
    throw new ApiError(401, "Unauthorized");
  }

  let progress = await Round3Progress.findOne({ teamId });

  if (!progress) {
    const team = await Team.findById(teamId).select("year");
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    const questions = await Round3Question.find({ year: team.year }).select(
      "_id bombNumber questionNumber questionText points"
    );

    if (!questions.length) {
      throw new ApiError(500, "Round 3 questions not configured");
    }

    const bombsMap = {};

    for (const q of questions) {
      if (!bombsMap[q.bombNumber]) {
        bombsMap[q.bombNumber] = {
          bombNumber: q.bombNumber,
          mistakes: 0,
          questions: [],
        };
      }

      bombsMap[q.bombNumber].questions.push({
        questionId: q._id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        points: q.points,
        solved: false,
        attempts: 0,
      });
    }

    progress = await Round3Progress.create({
      teamId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      bombs: Object.values(bombsMap),
      scoreAdded: 0,
    });
  }

  const remainingTime = ROUND3_DURATION_MS; // testing

  return res.json(
    new ApiResponse(200, {
      status: progress.status,
      timeRemainingMs: remainingTime,
      bombs: progress.bombs,
    })
  );
});

/**
 * SUBMIT ROUND 3 ANSWER
 */
export const submitRound3Answer = asyncHandler(async (req, res) => {
  const teamId = req.teamId;
  const { bombNumber, questionNumber, answer } = req.body;

  if (!teamId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (
    bombNumber === undefined ||
    questionNumber === undefined ||
    !answer
  ) {
    throw new ApiError(
      400,
      "bombNumber, questionNumber and answer are required"
    );
  }

  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  // ❌ Prevent re-submission
  if (team.rounds?.round3?.completed) {
    return res.json(
      new ApiResponse(400, null, "Round 3 already completed")
    );
  }

  const progress = await Round3Progress.findOne({ teamId });

  if (!progress) {
    throw new ApiError(400, "Round 3 not initialized");
  }

  if (progress.status !== "IN_PROGRESS") {
    throw new ApiError(403, `Round is ${progress.status}`);
  }

  const bomb = progress.bombs.find(
    (b) => b.bombNumber === Number(bombNumber)
  );

  if (!bomb) {
    throw new ApiError(404, "Bomb not found");
  }

  const question = bomb.questions.find(
    (q) => q.questionNumber === Number(questionNumber)
  );

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  if (question.solved) {
    return res.json(
      new ApiResponse(200, { status: "ALREADY_SOLVED" }, "Already solved")
    );
  }

  const dbQuestion = await Round3Question.findById(
    question.questionId
  ).select("correctAnswer points");

  if (!dbQuestion) {
    throw new ApiError(500, "Question data missing");
  }

  const normalizedAnswer = String(answer).trim().toUpperCase();

  /**
   * ✅ CORRECT ANSWER
   */
  if (normalizedAnswer === dbQuestion.correctAnswer) {
    question.solved = true;

    progress.scoreAdded += dbQuestion.points;

    await progress.save();

    // Check if all questions solved
    const allSolved = progress.bombs.every((b) =>
      b.questions.every((q) => q.solved)
    );

    // 🔥 If round finished
    if (allSolved) {
      progress.status = "COMPLETED";
      progress.endedAt = new Date();

      // Init rounds (old DB safety)
      if (!team.rounds) {
        team.rounds = {
          round1: { score: 0, completed: false },
          round2: { score: 0, completed: false },
          round3: { score: 0, completed: false },
        };
      }

      // Save round 3 score
      team.rounds.round3.score = progress.scoreAdded;
      team.rounds.round3.completed = true;

      // Recalculate total
      team.totalPoints =
        (team.rounds?.round1?.score || 0) +
        (team.rounds?.round2?.score || 0) +
        (team.rounds?.round3?.score || 0);

      await team.save();
      await progress.save();

      // 🚀 Emit leaderboard ONCE
      await emitLeaderboard(req);
    }

    return res.json(
      new ApiResponse(
        200,
        {
          correct: true,
          pointsAwarded: dbQuestion.points,
          totalRound3Score: progress.scoreAdded,
          roundCompleted: progress.status === "COMPLETED",
        },
        "Correct answer"
      )
    );
  }

  /**
   * ❌ WRONG ANSWER
   */
  question.attempts += 1;
  bomb.mistakes += 1;

  if (bomb.mistakes > MAX_MISTAKES_PER_BOMB) {
    progress.status = "DISQUALIFIED";
    progress.endedAt = new Date();

    await progress.save();

    throw new ApiError(
      403,
      "Too many incorrect attempts. Team disqualified."
    );
  }

  await progress.save();

  throw new ApiError(400, "Incorrect answer");
});
