import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";
import PendingCredential from "@/models/PendingCredential";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getAuthCookieOptions,
  signAccessToken,
  signRefreshToken,
} from "@/lib/auth";
import {
  buildIdentifierQuery,
  credentialMatchesUsername,
  issueOfflineCredential,
  normalizeIdentifier,
  normalizeIdentity,
  verifyOfflineCredential,
} from "@/lib/offlineCredential";

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

const mapLoginUser = (user) => ({
  id: user?._id?.toString?.() || user?.id || "",
  email: user?.email || "",
  username: user?.username || "",
  name: user?.name || "",
  repId: user?.repId || "",
  role: user?.role || "",
});

const findUserByIdentifier = async (identifier) => {
  const query = buildIdentifierQuery(identifier);
  if (!query) return null;
  return User.findOne(query);
};

const createUserFromCredential = async (
  payload,
  credentialValue,
  identifier,
  options = {}
) => {
  const identity = normalizeIdentity(payload);
  const username = normalizeText(identity.username || identifier);
  if (!username) return null;
  const resolvedEmail = buildOfflineEmail({
    email: identity.email,
    repId: identity.repId,
    username,
  });

  const passwordHash = await bcrypt.hash(credentialValue, 10);
  const issuedAt = new Date(payload.createdAt || options?.createdAt || Date.now());
  const safeIssuedAt = Number.isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

  try {
    const created = await User.create({
      name: identity.name || username,
      username,
      repId: identity.repId,
      role: identity.role || "Representative",
      accessType: "representative",
      email: resolvedEmail,
      password: passwordHash,
      keygen: credentialValue,
      keygenIssuedAt: safeIssuedAt,
    });
    return created;
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findUserByIdentifier(username);
      if (existing) return existing;
      if (identity.repId) {
        const byRepId = await findUserByIdentifier(identity.repId);
        if (byRepId) return byRepId;
      }
      const byEmail = await findUserByIdentifier(resolvedEmail);
      if (byEmail) return byEmail;
      return null;
    }
    throw error;
  }
};

const authenticateWithCredential = async ({
  credentialValue,
  identifier,
  createdAt,
}) => {
  const inputIdentifier = normalizeText(identifier);
  const verified = verifyOfflineCredential(credentialValue, {
    username: inputIdentifier,
  });
  if (!verified) {
    return { error: "Invalid keygen password", status: 401 };
  }

  if (inputIdentifier && !credentialMatchesUsername(verified, inputIdentifier)) {
    return {
      error: "Username does not match the issued credential",
      status: 401,
    };
  }

  const credentialHash = hashCredential(credentialValue);
  const normalizedCredentialUsername = normalizeIdentifier(verified.username || inputIdentifier);
  const pending = normalizedCredentialUsername
    ? await PendingCredential.findOne({ username: normalizedCredentialUsername })
    : null;

  if (pending?.credentialHash && pending.credentialHash !== credentialHash) {
    return { error: "Invalid keygen password", status: 401 };
  }

  let user = null;
  if (verified.userId) {
    user = await User.findById(verified.userId);
  }

  if (!user && verified.username) {
    user = await findUserByIdentifier(verified.username);
  }

  if (!user && verified.repId) {
    user = await findUserByIdentifier(verified.repId);
  }

  if (!user && verified.email) {
    user = await findUserByIdentifier(verified.email);
  }

  if (!user && inputIdentifier) {
    user = await findUserByIdentifier(inputIdentifier);
  }

  const hadExistingUser = Boolean(user);

  if (!user) {
    const payloadForCreate = pending
      ? {
          ...verified,
          username: pending.username || verified.username,
          name: pending.name || verified.name || inputIdentifier,
          repId: pending.repId || verified.repId,
          role: pending.role || verified.role,
          email: pending.email || verified.email,
          createdAt: pending.credentialIssuedAt || verified.createdAt,
        }
      : verified;

    user = await createUserFromCredential(payloadForCreate, credentialValue, inputIdentifier, {
      createdAt: createdAt || pending?.credentialIssuedAt,
    });
  }

  if (!user) {
    return { error: "Invalid keygen password", status: 401 };
  }

  const userUsername = normalizeIdentifier(user.username || user.name || user.email);
  const tokenUsername = normalizeIdentifier(verified.username);
  if (userUsername && tokenUsername && userUsername !== tokenUsername) {
    return { error: "Invalid keygen password", status: 401 };
  }

  let userChanged = false;
  if (pending) {
    const userRepId = normalizeText(user.repId);
    const userRole = normalizeText(user.role);
    const userName = normalizeText(user.name);
    const userEmail = normalizeEmail(user.email);
    const pendingEmail = normalizeEmail(pending.email);
    const hasFallbackEmail = userEmail.endsWith("@offline.otsuka.local");

    if (!userRepId && pending.repId) {
      user.repId = pending.repId;
      userChanged = true;
    }
    if (!userRole && pending.role) {
      user.role = pending.role;
      userChanged = true;
    }
    if (!userName && pending.name) {
      user.name = pending.name;
      userChanged = true;
    }
    if (pendingEmail && (!userEmail || hasFallbackEmail)) {
      user.email = pendingEmail;
      userChanged = true;
    }
  }

  if (!user.keygen) {
    user.keygen = credentialValue;
    user.keygenIssuedAt = new Date(
      pending?.credentialIssuedAt || verified.createdAt || Date.now()
    );
    user.password = await bcrypt.hash(credentialValue, 10);
    userChanged = true;
  } else if (
    user.keygen !== credentialValue &&
    !(
      verified.format === "short" &&
      normalizeIdentifier(user.keygen) === normalizeIdentifier(credentialValue)
    )
  ) {
    if (pending?.credentialHash === credentialHash) {
      user.keygen = credentialValue;
      user.keygenIssuedAt = new Date(
        pending?.credentialIssuedAt || verified.createdAt || Date.now()
      );
      user.password = await bcrypt.hash(credentialValue, 10);
      userChanged = true;
    } else {
      return { error: "Invalid keygen password", status: 401 };
    }
  }

  if (userChanged) {
    await user.save();
  }

  if (pending) {
    if (hadExistingUser) {
      pending.consumedAt = new Date();
      await pending.save();
    } else {
      await PendingCredential.deleteOne({ _id: pending._id });
    }
  }

  return {
    user,
    method: "keygen",
  };
};

export async function POST(request) {
  try {
    const { email, username, password, licenseKey, createdAt } = await request.json();

    const identifier = normalizeText(email || username);
    const rawPassword = String(password || "");
    const normalizedKeyPassword = rawPassword.trim();
    const rawLicenseKey = String(licenseKey || "").trim();

    await connectDB();

    let user = null;
    let method = "password";

    const credentialFromPassword = normalizedKeyPassword;
    const credentialValue = rawLicenseKey || credentialFromPassword;

    if (rawLicenseKey) {
      const authResult = await authenticateWithCredential({
        credentialValue,
        identifier,
        createdAt,
      });
      if (authResult?.error) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status });
      }
      user = authResult.user;
      method = authResult.method;
    } else {
      if (!identifier || !rawPassword) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 }
        );
      }

      user = await findUserByIdentifier(identifier);
      if (user) {
        const isValidPassword = await bcrypt.compare(rawPassword, user.password);
        if (!isValidPassword) {
          user = null;
        } else {
          const verifiedAsKey = verifyOfflineCredential(normalizedKeyPassword, {
            username: identifier,
          });
          if (
            verifiedAsKey &&
            user?.keygen &&
            (user.keygen === normalizedKeyPassword ||
              (verifiedAsKey.format === "short" &&
                normalizeIdentifier(user.keygen) === normalizeIdentifier(normalizedKeyPassword)))
          ) {
            method = "keygen";
          }
        }
      }

      if (!user) {
        const authResult = await authenticateWithCredential({
          credentialValue: rawPassword,
          identifier,
          createdAt,
        });
        if (authResult?.error) {
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        user = authResult.user;
        method = authResult.method;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.keygen) {
      const generated = issueOfflineCredential({
        userId: user._id?.toString?.(),
        username: user.username || user.name || user.email,
        name: user.name,
        repId: user.repId,
        role: user.role,
        email: user.email,
      });

      if (generated) {
        user.keygen = generated;
        user.keygenIssuedAt = new Date();
        await user.save();
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: "Auth server is misconfigured" },
        { status: 500 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        token: accessToken,
        method,
        user: mapLoginUser(user),
      },
      { status: 200 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, getAuthCookieOptions(60 * 15));
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getAuthCookieOptions(60 * 60 * 24 * 30));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
