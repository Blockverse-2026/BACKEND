import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = mongoose.connect(process.env.MONGO_URI);
    console.log("MogoDB is connected....");
  } catch (error) {
    console.log("MogoDB is not connected....");
    process.exit(1);
  }
};

export default connectDB;
