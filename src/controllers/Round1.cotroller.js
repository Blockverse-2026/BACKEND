import Round1Question from "../models/Round_1_questions.model.js";
import Round1Progress from "../models/Round1_progress.model.js";
import Team from "../models/team.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { emitLeaderboard } from "../utils/emitLeaderboard.js";
import { calculateTeamScore } from "../utils/calculateScore.js";

/**
 * GET ROUND 1 QUESTIONS
 */
export const getRound1Questions = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const team = await Team.findById(teamId).select("year");
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  const progress =
    (await Round1Progress.findOne({ teamId })) ||
    (await Round1Progress.create({ teamId }));

  const questions = await Round1Question.find({ year: team.year })
    .sort({ order: 1 })
    .select("questionId order question options pointReward year");

  return res.json(
    new ApiResponse(200, {
      totalQuestions: questions.length,
      solvedCount: progress.solvedQuestions.length,
      questions,
    })
  );
});

/**
 * SUBMIT ROUND 1 ANSWER
 */
export const submitRound1Answer = asyncHandler(async (req, res) => {
  const teamId = req.user._id;
  const { questionId, selectedOption } = req.body;

  if (!questionId || selectedOption == null) {
    throw new ApiError(400, "Question ID and option required");
  }

  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  // ❌ Prevent submissions if round already completed
  if (team.rounds.round1.completed) {
    return res.json(
      new ApiResponse(400, null, "Round 1 already completed")
    );
  }

  const question = await Round1Question.findOne({ questionId }).select(
    "+correctAnswer +pointReward"
  );

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  let progress = await Round1Progress.findOne({ teamId });
  if (!progress) {
    progress = await Round1Progress.create({ teamId });
  }

  // Already solved
  if (progress.solvedQuestions.includes(questionId)) {
    return res.json(new ApiResponse(200, null, "Already solved"));
  }

  const correct = question.correctAnswer.trim().toLowerCase();
  const selected = selectedOption.trim().toLowerCase();

  if (correct !== selected) {
    return res.json(
      new ApiResponse(200, { correct: false }, "Incorrect answer")
    );
  }

  // ✅ Correct answer
  progress.solvedQuestions.push(questionId);

  // Example: round finishes at 50 questions
  const ROUND_1_TOTAL = 50;

  if (progress.solvedQuestions.length === ROUND_1_TOTAL) {
    progress.completed = true;

    // 🔥 Calculate final round 1 score
    const round1Score = await calculateTeamScore(teamId);

    // Save into Team schema
    team.rounds.round1.score = round1Score;
    team.rounds.round1.completed = true;

    // Recalculate total points
    team.totalPoints =
      team.rounds.round1.score +
      team.rounds.round2.score +
      team.rounds.round3.score;

    await team.save();

    // 🚀 Emit leaderboard ONLY once
    await emitLeaderboard(req);
  }

  await progress.save();

  return res.json(
    new ApiResponse(
      200,
      { points: question.pointReward },
      "Correct answer"
    )
  );
});

/**
 * GET ROUND 1 PROGRESS
 */
export const getRound1Progress = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const progress = await Round1Progress.findOne({ teamId });

  if (!progress) {
    return res.json(
      new ApiResponse(200, { solved: [], score: 0 }, "No progress yet")
    );
  }

  const score = await calculateTeamScore(teamId);

  return res.json(
    new ApiResponse(
      200,
      {
        solved: progress.solvedQuestions,
        score,
        completed: progress.completed,
      },
      "Round 1 progress"
    )
  );
});
