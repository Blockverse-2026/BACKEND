import Round1Question from "../models/Round_1_questions.model.js";
import Round1Progress from "../models/Round1_progress.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const ROUND_1_DURATION_MS = 30 * 60 * 1000;
const POINTS_PER_CORRECT = 5;

export const getRound1Questions = asyncHandler(async (req, res) => {
  const teamId = req.teamId;

  if (!teamId) {
    throw new ApiError(401, "Unauthorized");
  }

  let progress = await Round1Progress.findOne({ teamId });

  if (!progress) {
    const questions = await Round1Question.find().select("_id");

    if (!questions.length) {
      throw new ApiError(500, "No Round 1 questions configured");
    }

    const shuffledOrder = questions
      .map((q) => q._id)
      .sort(() => Math.random() - 0.5);

    progress = await Round1Progress.create({
      teamId,
      questionOrder: shuffledOrder,
      solvedQuestions: [],
      score: 0,
      startedAt: new Date(),
    });
  }

  let needsSave = false;

  if (!progress.questionOrder || !Array.isArray(progress.questionOrder)) {
  const questions = await Round1Question.find().select("_id");

  if (!questions.length) {
    throw new ApiError(500, "No Round 1 questions configured");
  }

  progress.questionOrder = questions
    .map((q) => q._id)
    .sort(() => Math.random() - 0.5);

  needsSave = true;;
}

  if (!progress.startedAt) {
  progress.startedAt = new Date();
  needsSave = true;;
}

if (needsSave) {
  await progress.save();
}

const elapsed = Date.now() - progress.startedAt.getTime();
const remainingTime = Math.max(ROUND_1_DURATION_MS - elapsed, 0);

  const questions = await Round1Question.find(
    { _id: { $in: progress.questionOrder } },
    "questionId question"
  );

  const questionMap = new Map(
    questions.map((q) => [q._id.toString(), q])
  );

  const orderedQuestions = progress.questionOrder
    .map((id) => questionMap.get(id.toString()))
    .filter(Boolean);

  return res.json(
    new ApiResponse(200, {
      totalQuestions: orderedQuestions.length,
      solvedCount: progress.solvedQuestions.length,
      score: progress.score,
      timeRemainingMs: remainingTime,
      questions: orderedQuestions,
    })
  );
});

export const submitRound1Answer = asyncHandler(async (req, res) => {
  const teamId = req.teamId;
  const { questionId, answer } = req.body;

  if (!teamId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!questionId || answer === undefined) {
    throw new ApiError(400, "Question ID and answer are required");
  }

  const progress = await Round1Progress.findOne({ teamId });

  if (!progress) {
    throw new ApiError(400, "Round 1 not initialized");
  }

  const elapsed = Date.now() - progress.startedAt.getTime();
  if (elapsed > ROUND_1_DURATION_MS) {
    throw new ApiError(403, "Round 1 has ended");
  }

  if (progress.solvedQuestions.includes(questionId)) {
    return res.json(
      new ApiResponse(200, {
        correct: true,
        alreadySolved: true,
        score: progress.score,
      })
    );
  }

  const question = await Round1Question.findById(questionId).select(
    "+correctAnswer"
  );

  if (!question) {
    throw new ApiError(404, "Round 1 question not found");
  }

  const normalizedAnswer = String(answer).trim().toLowerCase();
  const expectedAnswer = String(question.correctAnswer).trim().toLowerCase();

  if (normalizedAnswer !== expectedAnswer) {
    return res.json(
      new ApiResponse(200, { correct: false }, "Incorrect answer")
    );
  }

  progress.solvedQuestions.push(questionId);
  progress.score += POINTS_PER_CORRECT;

  await progress.save();

  return res.json(
    new ApiResponse(
      200,
      {
        correct: true,
        score: progress.score,
        pointsAwarded: POINTS_PER_CORRECT,
      },
      "Correct answer"
    )
  );
});
