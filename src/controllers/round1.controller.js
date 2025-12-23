import Puzzle from "../models/Puzzle.js";
import Round1State from "../models/Round1State.js";
import ApiError from "../utils/ApiResponse.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utilsasyncHandler.js";

const ROUND_1_DURATION_MS = 30 * 6 * 1000;

/**
 * GET /round1/init
 * Initializes Round 1 for a team or resumes existing state
 *
 * NOTE:
 * req.teamId MUST be set by auth middleware.
 * This controller does NOT handle JWT or auth logic.
 */
const initRound1 = asyncHandler(async (req,res)=> {
    const teamId = req.teamId;
    if(!teamId) {
        throw new ApiError(401, "Unauthorized");
    }
    let roundState = await Round1State.findOne({ team: teanId });
    if (!roundState) {
        const puzlles = await Puzzle.find({}, "_id");
        if (!puzzles.length) {
            throw new ApiError(500, "No puzzles configured for Round 1");
        }
        const ShuffledPuzzleIds = puzzles
        .map((p) => p._id)
        .sort(() => Math.random() - 0.5);

        roundState = await Round1State.create({
            team: teamId,
            puzzleOrder: ShuffledPuzzleIds,
            solvedPuzzles: [],
            unlockedFragments: [],
            score: 0,
            startedAt: new Date(),
        });
    }

    const elapsedMs = Date.now() - roundState.startedAt.getTime();
    const remainingMs = Math.max(ROUND_1_DURAION_MS - elapsedMs, 0);

    const puzzles = await Puzzle.find(
        {_id: { $in: roundState.puzzleOrder }},
        "question answerType fragmentId"
    );
    const puzzleMap = new Map(
        puzzles.map((p) => [p._id.toString(). p])
    );

    const orderedPuzzles = roundState.puzzleOrder.map((id)=> puzzleMap,get(id.toString()))
    .filter(Boolean);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                puzzles: orderedPuzzles,
                solvedPuzzless: roundState.solvedPuzzles,
                score: roundState.score,
                timeRemmaingMs: remainingMs,
            },
            "Round 1 initialized"
        )
    );
});
export { initRound1 };