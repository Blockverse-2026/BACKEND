import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    teamId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      enum: [1, 2],
      required: true,
    },
    members: [
      {
        name: String,
        rollNo: String,
        branch: String,
        email: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
