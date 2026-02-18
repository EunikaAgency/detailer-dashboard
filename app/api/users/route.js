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

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const users = await User.find().sort({ createdAt: -1 }).select("-password").lean();
    const secret = getJwtSecret();

    if (secret) {
      const missingKeygen = users.filter((user) => !user?.keygen);
      if (missingKeygen.length) {
        const bulkOps = missingKeygen.map((user) => ({
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                keygen: jwt.sign(
                  { userId: user._id?.toString?.() || user.id, email: user.email },
                  secret
                ),
              },
            },
          },
        }));
        await User.bulkWrite(bulkOps);

        missingKeygen.forEach((user) => {
          user.keygen = jwt.sign(
            { userId: user._id?.toString?.() || user.id, email: user.email },
            secret
          );
        });
      }
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    console.log('[CREATE USER] Received body:', JSON.stringify(body));
    
    const { name, email, password } = body;
    const trimmedName = String(name || "").trim();
    const trimmedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");
    
    console.log('[CREATE USER] Extracted fields:', { name, trimmedName, trimmedEmail });

    if (!trimmedName || !trimmedEmail || !rawPassword) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
    }

    const secret = getJwtSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "JWT secret is missing. Configure JWT_SECRET." },
        { status: 500 }
      );
    }

    await connectDB();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    
    console.log('[CREATE USER] Creating user with:', { name: trimmedName, email: trimmedEmail });
    
    const created = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
    });
    
    console.log('[CREATE USER] User created:', { id: created._id, name: created.name, email: created.email });

    created.keygen = jwt.sign(
      { userId: created._id?.toString?.() || created.id, email: created.email },
      secret
    );
    await created.save();

    return NextResponse.json(
      {
        user: {
          id: created._id,
          name: created.name,
          email: created.email,
          keygen: created.keygen,
          createdAt: created.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
