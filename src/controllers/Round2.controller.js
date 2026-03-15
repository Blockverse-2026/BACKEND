const ROUND2_DURATION_MS = 15 * 60 * 1000; // 15 minutes

import Round2Question from "../models/round2_phase_1.model.js";
import Round2Progress from "../models/Round2_progress.model.js";
import Round2Clues from "../models/round2_phase2_store_clue.model.js";
import Team from "../models/team.model.js";

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { emitLeaderboard } from "../utils/emitLeaderboard.js";
// import { calculateTeamScore } from "../utils/calculateScore.js";

export const initRound2 = asyncHandler(async (req, res) => {
  const teamId = req.user?._id;
  if (!teamId) throw new ApiError(401, "Unauthorized");

  let progress = await Round2Progress.findOne({ teamId });

  if (!progress || !progress.questions || progress.questions.length === 0) {
    if (progress) {
      await Round2Progress.deleteOne({ teamId });
    }

    const team = await Team.findById(teamId).select("year");
    if (!team) throw new ApiError(404, "Team not found");

    const questions = await Round2Question.find({ year: team.year })
      .sort({ order: 1 })
      .select("_id question options tokenReward");

    if (!questions.length)
      throw new ApiError(500, "Round 2 questions not configured");

    const formatted = questions.map((q) => ({
      questionId: q._id,
      questionText: q.question,
      options: q.options,
      tokenReward: q.tokenReward,
      solved: false,
      attempts: 0,
    }));

    progress = await Round2Progress.create({
      teamId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      tokens: 0,
      solvedQuestions: [],
      purchasedClues: [],
      questions: formatted,
      phase: 1,
      storeUnlocked: false,
    });
  }

  const elapsed = Date.now() - new Date(progress.startedAt).getTime();
  const remainingTime = Math.max(ROUND2_DURATION_MS - elapsed, 0);

  if (remainingTime === 0 && progress.status !== "TIME_UP") {
    progress.status = "TIME_UP";
    progress.endedAt = new Date();
    await progress.save();
  }

  return res.json(
    new ApiResponse(200, {
      status: progress.status,
      timeRemainingMs: remainingTime,
      tokens: progress.tokens,
      questions: progress.questions,
    })
  );
});



export const getRound2Phase1Questions = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const team = await Team.findById(teamId).select("year");
  if (!team) throw new ApiError(404, "Team not found");

  const progress = await Round2Progress.findOne({ teamId });
  if (!progress) throw new ApiError(400, "Round 2 not initialized");

  const questions = await Round2Question.find({ year: team.year })
    .sort({ order: 1 })
    .select("_id question options tokenReward");

  return res.json(
    new ApiResponse(200, {
      totalQuestions: questions.length,
      solvedCount: progress.solvedQuestions.length,
      tokens: progress.tokens,
      questions,
    })
  );
});



export const submitRound2Phase1Answer = asyncHandler(async (req, res) => {
  const teamId = req.user._id;
  const { questionId, answer } = req.body;

  if (!questionId || !answer)
    throw new ApiError(400, "Question ID and answer required");

  const question = await Round2Question.findById(questionId).select(
    "+correctAnswer tokenReward"
  );

  if (!question) throw new ApiError(404, "Question not found");

  const progress = await Round2Progress.findOne({ teamId });
  if (!progress) throw new ApiError(400, "Round 2 not initialized");

  if (progress.solvedQuestions.includes(questionId)) {
    return res.json(new ApiResponse(200, null, "Already solved"));
  }

  const normalizedAnswer = String(answer).trim().toLowerCase();
  const correctAnswer = String(question.correctAnswer).trim().toLowerCase();

  if (normalizedAnswer !== correctAnswer) {
    throw new ApiError(400, "Incorrect answer");
  }

  progress.solvedQuestions.push(questionId);
  progress.tokens += question.tokenReward;

  const progressQuestion = progress.questions.find(
    (q) => q.questionId.toString() === questionId
  );

  if (progressQuestion) progressQuestion.solved = true;

  if (progress.solvedQuestions.length === progress.questions.length) {
    progress.phase = 2;
    progress.storeUnlocked = true;
  }

  await progress.save();

  await emitLeaderboard(req);

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

export const getStoreClues = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const team = await Team.findById(teamId).select("year");
  const progress = await Round2Progress.findOne({ teamId });

  if (!progress) throw new ApiError(400, "Round 2 not initialized");

  const clues = await Round2Clues.find({ year: team.year });

  const availableClues = clues.filter(
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



export const buyClue = asyncHandler(async (req, res) => {
  const teamId = req.user._id;
  const { clueId } = req.body;

  if (!clueId) throw new ApiError(400, "Clue ID required");

  const progress = await Round2Progress.findOne({ teamId });
  if (!progress) throw new ApiError(400, "Round 2 not initialized");

  const clue = await Round2Clues.findOne({ clueId });
  if (!clue) throw new ApiError(404, "Clue not found");

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
          description: clue.description,
        },
      },
      "Clue purchased successfully"
    )
  );
});



export const getRound2Progress = asyncHandler(async (req, res) => {
  const teamId = req.user._id;

  const progress = await Round2Progress.findOne({ teamId });

  if (!progress) {
    return res.json(
      new ApiResponse(
        200,
        { solved: [], tokens: 0, purchasedClues: [] },
        "No progress yet"
      )
    );
  }

  const score = await calculateTeamScore(teamId);

  return res.json(
    new ApiResponse(
      200,
      {
        solved: progress.solvedQuestions,
        tokens: progress.tokens,
        purchasedClues: progress.purchasedClues,
        score,
        phase: progress.phase,
      },
      "Round 2 progress"
    )
  );
});