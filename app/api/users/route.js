import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";
import PendingCredential from "@/models/PendingCredential";
import { requireAdmin } from "@/lib/auth";
import { getUserAccessType } from "@/lib/userAccess";
import {
  getOfflineCredentialSecret,
  issueOfflineCredential,
  normalizeIdentifier,
  normalizeIdentity,
} from "@/lib/offlineCredential";

export const runtime = "nodejs";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value) => String(value || "").trim();

const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const toLocalPart = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const buildOfflineEmail = ({ email, repId, username }) => {
  const normalized = normalizeEmail(email);
  if (normalized) return normalized;
  const seed = toLocalPart(repId || username || "offline-user");
  return `${seed || "offline.user"}@offline.otsuka.local`;
};

const hashCredential = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const duplicateErrorMessage = (error) => {
  if (!error || error.code !== 11000) return null;
  const key = Object.keys(error?.keyPattern || error?.keyValue || {})[0];
  if (key === "username") return "Username is already issued.";
  if (key === "repId") return "Rep ID is already issued.";
  if (key === "email") return "Identifier email is already in use.";
  return "User already exists.";
};

const mapUser = (user) => ({
  id: user?._id?.toString?.() || user?.id || "",
  name: user?.name || "",
  username: user?.username || "",
  email: user?.email || "",
  repId: user?.repId || "",
  role: user?.role || "",
  accessType: getUserAccessType(user),
  keygen: user?.keygen || "",
  keygenIssuedAt: user?.keygenIssuedAt || null,
  createdAt: user?.createdAt,
});

const isOfflineCredentialMode = (body = {}) => {
  const mode = normalizeText(body?.createMode).toLowerCase();
  return mode === "offline-credential";
};

const findCaseInsensitive = async (field, value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return User.findOne({ [field]: new RegExp(`^${escapeRegex(normalized)}$`, "i") });
};

const buildCredentialForUser = (user, issuedAt) => {
  const identity = normalizeIdentity({
    userId: user?._id?.toString?.() || user?.id,
    username: user?.username || user?.name || user?.email,
    name: user?.name,
    repId: user?.repId,
    role: user?.role,
    email: user?.email,
  });

  return issueOfflineCredential(identity, { issuedAt });
};

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const users = await User.find().sort({ createdAt: -1 }).select("-password").lean();
    const secret = getOfflineCredentialSecret();

    if (secret) {
      const missingKeygen = users.filter((user) => !user?.keygen);
      if (missingKeygen.length) {
        const now = new Date();
        const bulkOps = missingKeygen
          .map((user) => {
            const generated = buildCredentialForUser(user, now);
            if (!generated) return null;
            user.keygen = generated;
            user.keygenIssuedAt = now;
            return {
              updateOne: {
                filter: { _id: user._id },
                update: {
                  $set: {
                    keygen: generated,
                    keygenIssuedAt: now,
                  },
                },
              },
            };
          })
          .filter(Boolean);

        if (bulkOps.length) {
          await User.bulkWrite(bulkOps);
        }
      }
    }

    return NextResponse.json(users.map(mapUser));
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));

    const name = normalizeText(body?.name);
    const usernameInput = normalizeText(body?.username);
    const repId = normalizeText(body?.repId);
    const role = normalizeText(body?.role);
    const email = normalizeEmail(body?.email);
    const rawPassword = String(body?.password || "");

    const secret = getOfflineCredentialSecret();
    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Offline credential secret is missing. Configure OFFLINE_CREDENTIAL_SECRET (or JWT_SECRET).",
        },
        { status: 500 }
      );
    }

    const offlineMode = isOfflineCredentialMode(body);

    if (offlineMode) {
      const username = normalizeText(usernameInput);
      if (!username) {
        return NextResponse.json(
          { error: "Username is required for keygen issuance." },
          { status: 400 }
        );
      }

      const resolvedEmail = buildOfflineEmail({ email, repId, username });

      const issuedAt = new Date();
      const credential = issueOfflineCredential(
        {
          username,
          name: name || username,
          repId,
          role: role || "Representative",
          email: resolvedEmail,
        },
        { issuedAt }
      );

      if (!credential) {
        return NextResponse.json(
          { error: "Failed to generate offline credential." },
          { status: 500 }
        );
      }

      await connectDB();
      const normalizedUsername = normalizeIdentifier(username);
      await PendingCredential.findOneAndUpdate(
        { username: normalizedUsername },
        {
          $set: {
            username: normalizedUsername,
            name: name || username,
            repId,
            role: role || "Representative",
            email: resolvedEmail,
            credentialHash: hashCredential(credential),
            credentialIssuedAt: issuedAt,
            consumedAt: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return NextResponse.json(
        {
          user: null,
          issuedCredential: {
            username,
            password: credential,
            createdAt: issuedAt,
            dateCreated: issuedAt,
            repId,
            role: role || "Representative",
          },
          keygenOnly: true,
        },
        { status: 201 }
      );
    }

    await connectDB();

    const trimmedName = name;
    const trimmedEmail = email;

    if (!trimmedName || !trimmedEmail || !rawPassword) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    const existing = await findCaseInsensitive("email", trimmedEmail);
    if (existing) {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const created = await User.create({
      name: trimmedName,
      username: usernameInput || trimmedEmail,
      email: trimmedEmail,
      password: hashedPassword,
    });

    const keygenIssuedAt = new Date();
    const keygen = buildCredentialForUser(created, keygenIssuedAt);
    if (keygen) {
      created.keygen = keygen;
      created.keygenIssuedAt = keygenIssuedAt;
      await created.save();
    }

    return NextResponse.json(
      {
        user: mapUser(created),
      },
      { status: 201 }
    );
  } catch (error) {
    const duplicateMessage = duplicateErrorMessage(error);
    if (duplicateMessage) {
      return NextResponse.json({ error: duplicateMessage }, { status: 409 });
    }
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
