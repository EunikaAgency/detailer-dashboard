import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/db";
import User from "@/models/User";

export const ACCESS_TOKEN_COOKIE = "token";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  return typeof secret === "string" && secret.trim() ? secret : null;
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  return typeof secret === "string" && secret.trim() ? secret : null;
};

export const getAuthCookieOptions = (maxAgeSeconds) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: maxAgeSeconds,
  path: "/",
});

export const signAccessToken = (user) => {
  const secret = getJwtSecret();
  if (!secret) return null;
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      username: user.username || "",
      type: "access",
    },
    secret,
    { expiresIn: "15m" }
  );
};

export const signRefreshToken = (user) => {
  const secret = getRefreshSecret();
  if (!secret) return null;
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      username: user.username || "",
      type: "refresh",
    },
    secret,
    { expiresIn: "30d" }
  );
};

export const findUserById = async (userId) => {
  await connectDB();
  return User.findById(userId).select("-password");
};

export const verifyRefreshToken = (token) => {
  const secret = getRefreshSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    if (decoded?.type !== "refresh") return null;
    return decoded;
  } catch {
    return null;
  }
};

export const requireAuth = async (request) => {
  const cookieStore = await cookies();
  const cookieAccessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const cookieRefreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const headerToken = request?.headers
    ?.get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const token = cookieAccessToken || headerToken;

  if (!token && !cookieRefreshToken) {
    return { error: "Not authenticated", status: 401 };
  }

  const secret = getJwtSecret();
  if (!secret) {
    return { error: "Auth server is misconfigured", status: 500 };
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, secret);
      if (decoded?.type && decoded.type !== "access") {
        return { error: "Invalid token", status: 401 };
      }
      const user = await findUserById(decoded.userId);
      if (!user) {
        return { error: "User not found", status: 401 };
      }
      return { user };
    } catch {
      // If an explicit bearer token is supplied, do not fallback to cookie refresh token.
      if (headerToken) {
        return { error: "Invalid token", status: 401 };
      }
    }
  }

  if (cookieRefreshToken) {
    const decodedRefresh = verifyRefreshToken(cookieRefreshToken);
    if (decodedRefresh?.userId) {
      const user = await findUserById(decodedRefresh.userId);
      if (!user) {
        return { error: "User not found", status: 401 };
      }
      return { user };
    }
  }

  return { error: "Invalid token", status: 401 };
};
