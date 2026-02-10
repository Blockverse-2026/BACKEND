import Round2Question from "../models/round2_phase_1.model.js";
import Round2Progress from "../models/Round2_progress.model.js";
import Team from "../models/team.model.js";

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { emitLeaderboard } from "../utils/emitLeaderboard.js";
import Round2Clues from "../models/round2_phase2_store_clue.model.js";
import { calculateTeamScore } from "../utils/calculateScore.js";

/**
 * GET PHASE 1 QUESTIONS
 */
export const getRound2Phase1Questions = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const team = await Team.findById(teamId).select("year rounds");
  if (!team) throw new ApiError(404, "Team not found");

  const progress =
    (await Round2Progress.findOne({ teamId })) ||
    (await Round2Progress.create({ teamId }));

  if (team.rounds?.round2?.completed) {
    throw new ApiError(403, "Round 2 already completed");
  }

  if (progress.phase !== 1) {
    throw new ApiError(403, "Phase 1 completed");
  }

  const questions = await Round2Question.find({ year: team.year })
    .sort({ order: 1 })
    .select("questionId order question tokenReward");

  return res.json(
    new ApiResponse(200, {
      solvedCount: progress.solvedQuestions.length,
      tokens: progress.tokens,
      questions,
    })
  );
});

/**
 * SUBMIT PHASE 1 ANSWER
 */
export const submitRound2Phase1Answer = asyncHandler(async (req, res) => {
  const teamId = req.user._id;
  const { questionId, answer } = req.body;

  if (!questionId || !answer) {
    throw new ApiError(400, "Question ID and answer required");
  }

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, "Team not found");

  if (team.rounds?.round2?.completed) {
    return res.json(
      new ApiResponse(400, null, "Round 2 already completed")
    );
  }

  const question = await Round2Question.findOne({ questionId }).select(
    "+correctAnswer +tokenReward"
  );

  if (!question) throw new ApiError(404, "Question not found");

  const progress =
    (await Round2Progress.findOne({ teamId })) ||
    (await Round2Progress.create({ teamId }));

  if (progress.solvedQuestions.includes(questionId)) {
    return res.json(new ApiResponse(200, null, "Already solved"));
  }

  const correct = String(question.correctAnswer).trim().toLowerCase();
  const submitted = String(answer).trim().toLowerCase();

  if (correct !== submitted) {
    throw new ApiError(400, "Incorrect answer");
  }

  progress.solvedQuestions.push(questionId);
  progress.tokens += question.tokenReward;

  const ROUND2_TOTAL = 20;

  if (progress.solvedQuestions.length === ROUND2_TOTAL) {
    progress.phase = 2;
    progress.phase1Completed = true;
    progress.storeUnlocked = true;

    const round2Score = await calculateTeamScore(teamId);

    if (!team.rounds) {
      team.rounds = {
        round1: { score: 0, completed: false },
        round2: { score: 0, completed: false },
        round3: { score: 0, completed: false },
      };
    }

    team.rounds.round2.score = round2Score;
    team.rounds.round2.completed = true;

    team.totalPoints =
      (team.rounds?.round1?.score || 0) +
      (team.rounds?.round2?.score || 0) +
      (team.rounds?.round3?.score || 0);

    await team.save();

    await emitLeaderboard(req);
  }

  await progress.save();

  return res.json(
    new ApiResponse(
      200,
      {
        tokens: progress.tokens,
        storeUnlocked: progress.storeUnlocked,
      },
      "Correct answer"
    )
  );
});

/**
 * GET STORE CLUES
 */
export const getStoreClues = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const team = await Team.findById(teamId).select("year");
  const progress = await Round2Progress.findOne({ teamId });

  if (!progress) {
    throw new ApiError(404, "Progress not found");
  }

  const allClues = await Round2Clues.find({ year: team.year });

  const availableClues = allClues.filter(
    (clue) => !progress.purchasedClues.includes(clue.clueId)
  );

  return res.json(
    new ApiResponse(
      200,
      {
        tokensAvailable: progress.tokens,
        availableClues,
      },
      "Store clues fetched"
    )
  );
});

/**
 * BUY CLUE
 */
export const buyClue = asyncHandler(async (req, res) => {
  const teamId = req.user._id;
  const { clueId } = req.body;

  if (!clueId) {
    throw new ApiError(400, "Clue ID is required");
  }

  const progress = await Round2Progress.findOne({ teamId });

  if (!progress) {
    throw new ApiError(404, "Progress not found");
  }

  const clue = await Round2Clues.findOne({ clueId });

  if (!clue) {
    throw new ApiError(404, "Clue not found");
  }

  if (progress.tokens < clue.tokenCost) {
    throw new ApiError(400, "Insufficient tokens");
  }

  progress.tokens -= clue.tokenCost;
  progress.purchasedClues.push(clue.clueId);

  await progress.save();

  return res.json(
    new ApiResponse(
      200,
      {
        remainingTokens: progress.tokens,
        purchasedClue: {
          clueId: clue.clueId,
          title: clue.title,
        },
      },
      "Clue purchased successfully"
    )
  );
});

/**
 * GET ROUND 2 PROGRESS
 */
export const getRound2Progress = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const progress = await Round2Progress.findOne({ teamId });
  const team = await Team.findById(teamId);

  if (!progress || !team) {
    return res.json(
      new ApiResponse(
        200,
        { solved: [], score: 0, tokens: 0 },
        "No Progress Yet"
      )
    );
  }

  return res.json(
    new ApiResponse(
      200,
      {
        solved: progress.solvedQuestions,
        tokens: progress.tokens,
        purchasedClues: progress.purchasedClues,
        roundCompleted: team.rounds?.round2?.completed || false,
        score: team.rounds?.round2?.score || 0,
      },
      "Round 2 Progress"
    )
  );
});
