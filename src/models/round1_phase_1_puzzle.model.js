import mongoose from "mongoose";

const puzzleSchema = new mongoose.Schema({
  puzzleId: {
    type: String,
    require: true,
    unique: true,
  },

  round: {
    type: Number,
    require: true,
  }

}, { timestamps: true });

const Phase_1 = mongoose.model("Phase_1", puzzleSchema);

export default Phase_1;
