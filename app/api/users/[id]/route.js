import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  return typeof secret === "string" && secret.trim() ? secret : null;
};

const buildKeygen = (user) => {
  const secret = getJwtSecret();
  if (!secret) return null;
  return jwt.sign({ userId: user._id?.toString?.() || user.id, email: user.email }, secret);
};

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    let userId = params?.id;
    if (!userId) {
      userId = url.searchParams.get("id");
    }
    if (!userId) {
      const parts = url.pathname.split("/").filter(Boolean);
      userId = parts[parts.length - 1];
    }
    if (!userId) {
      userId = body?.id || body?.userId;
    }
    if (!userId) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    const { name, password } = body || {};
    
    console.log('[UPDATE USER] Extracted fields:', { name, password: password ? '[PRESENT]' : '[ABSENT]' });
    
    const update = {};
    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      }
      update.name = trimmedName;
      console.log('[UPDATE USER] Will update name to:', trimmedName);
    }
    if (typeof password === "string" && password) {
      update.password = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: "No update fields provided." }, { status: 400 });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "JWT secret is missing. Configure JWT_SECRET." },
        { status: 500 }
      );
    }

    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    console.log('[UPDATE USER] Before update:', { id: user._id, name: user.name, email: user.email });
    
    Object.assign(user, update);
    
    console.log('[UPDATE USER] After assign:', { id: user._id, name: user.name, email: user.email });

    // Ensure keygen exists
    if (!user.keygen) {
      user.keygen = jwt.sign(
        { userId: user._id?.toString?.() || user.id, email: user.email },
        secret
      );
    }

    await user.save();
    
    console.log('[UPDATE USER] After save:', { id: user._id, name: user.name, email: user.email });

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        keygen: user.keygen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    let userId = params?.id;
    if (!userId) {
      userId = url.searchParams.get("id");
    }
    if (!userId) {
      const parts = url.pathname.split("/").filter(Boolean);
      userId = parts[parts.length - 1];
    }
    if (!userId) {
      userId = body?.id || body?.userId;
    }
    if (!userId) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    await connectDB();
    const removed = await User.findByIdAndDelete(userId);
    if (!removed) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
