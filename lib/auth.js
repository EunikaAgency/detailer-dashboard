import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/db";
import User from "@/models/User";

export const requireAuth = async (request) => {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("token")?.value;
  const headerToken = request?.headers
    ?.get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const token = cookieToken || headerToken;

  if (!token) {
    return { error: "Not authenticated", status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    await connectDB();
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return { error: "User not found", status: 401 };
    }
    return { user };
  } catch (error) {
    return { error: "Invalid token", status: 401 };
  }
};
