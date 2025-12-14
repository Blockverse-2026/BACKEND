import Team from "../models/team.model.js";
import bcrypt from "bcryptjs";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const akgecEmailRegex = /^[a-zA-Z0-9._]+@akgec\.ac\.in$/;

const registerTeam = asyncHandler(async (req, res) => {
  let { teamId, password, year, members } = req.body;

  if (!teamId || !password || !year || !members?.length) {
    throw new ApiError(
      400,
      "Team ID, password, year and team members are required"
    );
  }

  if (![1, 2].includes(year)) {
    throw new ApiError(400, "Year must be 1 or 2");
  }

  teamId = teamId.trim().toUpperCase();

  const emails = members.map((m) => m.email?.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    throw new ApiError(400, "Duplicate emails in team members");
  }

  for (const member of members) {
    if (!member.name || !member.email || !member.rollNo) {
      throw new ApiError(400, "Invalid team member details");
    }
    if (!akgecEmailRegex.test(member.email)) {
      throw new ApiError(400, `Invalid college email: ${member.email}`);
    }
  }

  const existingTeam = await Team.findOne({ teamId });
  if (existingTeam) {
    throw new ApiError(409, "Team is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const team = await Team.create({
    teamId,
    password,
    year,
    members,
  });

  const teamResponse = team.toObject();
  delete teamResponse.passwordHash;

  return res
    .status(201)
    .json(new ApiResponse(201, teamResponse, "Team registered successfully"));
});

export { registerTeam };
