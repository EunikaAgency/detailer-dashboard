import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  findUserById,
  getAuthCookieOptions,
  signAccessToken,
  verifyRefreshToken,
} from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const user = await findUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const accessToken = signAccessToken(user);
    if (!accessToken) {
      return NextResponse.json({ error: "Auth server is misconfigured" }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
      },
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, getAuthCookieOptions(60 * 15));
    return response;
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}
