import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireAdmin } from "@/lib/auth";
import { normalizeReportDivision } from "@/lib/reportDivision";
import { getUserAccessType, normalizeAccessType } from "@/lib/userAccess";
import { getOfflineCredentialSecret, issueOfflineCredential, normalizeIdentity } from "@/lib/offlineCredential";

export const runtime = "nodejs";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value) => String(value || "").trim();

const mapUser = (user) => ({
  id: user?._id?.toString?.() || user?.id || "",
  name: user?.name || "",
  username: user?.username || "",
  email: user?.email || "",
  repId: user?.repId || "",
  role: user?.role || "",
  division: user?.division || "",
  storedAccessType: normalizeAccessType(user?.accessType),
  accessType: getUserAccessType(user),
  keygen: user?.keygen || "",
  keygenIssuedAt: user?.keygenIssuedAt || null,
  createdAt: user?.createdAt,
});

const parseUserIdFromRequest = async (request, params) => {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const resolvedParams = await params;

  let userId = resolvedParams?.id;
  if (!userId) userId = url.searchParams.get("id");
  if (!userId) {
    const parts = url.pathname.split("/").filter(Boolean);
    userId = parts[parts.length - 1];
  }
  if (!userId) userId = body?.id || body?.userId;

  return {
    userId,
    body,
  };
};

const findDuplicate = async (field, value, userId) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const duplicate = await User.findOne({
    [field]: new RegExp(`^${escapeRegex(normalized)}$`, "i"),
    _id: { $ne: userId },
  });

  return duplicate;
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

export async function PUT(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId, body } = await parseUserIdFromRequest(request, params);
    if (!userId) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const hasName = typeof body?.name === "string";
    const hasUsername = typeof body?.username === "string";
    const hasRepId = typeof body?.repId === "string";
    const hasRole = typeof body?.role === "string";
    const hasDivision = typeof body?.division === "string";
    const hasAccessType = typeof body?.accessType === "string";
    const hasPassword = typeof body?.password === "string";
    const rawPassword = hasPassword ? String(body.password || "") : "";
    const hasManualPassword = hasPassword && rawPassword.length > 0;

    if (
      !hasName &&
      !hasUsername &&
      !hasRepId &&
      !hasRole &&
      !hasDivision &&
      !hasAccessType &&
      !hasPassword &&
      !body?.reissueKeygen
    ) {
      return NextResponse.json({ error: "No update fields provided." }, { status: 400 });
    }

    if (hasName) {
      const name = normalizeText(body.name);
      if (!name) {
        return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      }
      user.name = name;
    }

    const nextUsername = hasUsername ? normalizeText(body.username) : normalizeText(user.username);
    const nextRepId = hasRepId ? normalizeText(body.repId) : normalizeText(user.repId);
    const nextRole = hasRole ? normalizeText(body.role) : normalizeText(user.role);
    const didUsernameChange = nextUsername !== normalizeText(user.username);
    const didRepIdChange = nextRepId !== normalizeText(user.repId);
    const didRoleChange = nextRole !== normalizeText(user.role);

    if (hasUsername) {
      if (!nextUsername) {
        return NextResponse.json({ error: "Username cannot be empty." }, { status: 400 });
      }
      if (didUsernameChange) {
        const duplicate = await findDuplicate("username", nextUsername, user._id);
        if (duplicate) {
          return NextResponse.json({ error: "Username is already issued." }, { status: 409 });
        }
      }
      user.username = nextUsername;
    }

    if (hasRepId) {
      if (!nextRepId) {
        return NextResponse.json({ error: "Rep ID cannot be empty." }, { status: 400 });
      }
      if (didRepIdChange) {
        const duplicate = await findDuplicate("repId", nextRepId, user._id);
        if (duplicate) {
          return NextResponse.json({ error: "Rep ID is already issued." }, { status: 409 });
        }
      }
      user.repId = nextRepId;
    }

    if (hasRole) {
      if (!nextRole) {
        return NextResponse.json({ error: "Role cannot be empty." }, { status: 400 });
      }
      user.role = nextRole;
    }

    if (hasDivision) {
      user.division = normalizeReportDivision(body.division);
    }

    if (hasAccessType) {
      const accessType = normalizeAccessType(body.accessType);
      if (!accessType) {
        return NextResponse.json(
          { error: "Access type must be admin or representative." },
          { status: 400 }
        );
      }
      user.accessType = accessType;
    }

    if (hasManualPassword && rawPassword.length < 8) {
      return NextResponse.json(
        { error: "Manual password must be at least 8 characters." },
        { status: 400 }
      );
    }

    let issuedCredential = null;
    const shouldReissue =
      Boolean(body?.reissueKeygen) || didUsernameChange || didRepIdChange || didRoleChange;
    const manualPasswordHash = hasManualPassword ? await bcrypt.hash(rawPassword, 10) : null;

    if (shouldReissue || !user.keygen) {
      const secret = getOfflineCredentialSecret();
      if (!secret) {
        return NextResponse.json(
          { error: "JWT secret is missing. Configure JWT_SECRET." },
          { status: 500 }
        );
      }

      const issuedAt = new Date();
      const credential = buildCredentialForUser(user, issuedAt);

      if (!credential) {
        return NextResponse.json(
          { error: "Failed to generate offline credential." },
          { status: 500 }
        );
      }

      user.keygen = credential;
      user.keygenIssuedAt = issuedAt;
      if (!manualPasswordHash) {
        user.password = await bcrypt.hash(credential, 10);
      }

      issuedCredential = {
        username: user.username || user.name,
        password: credential,
        createdAt: issuedAt,
        repId: user.repId || "",
        role: user.role || "",
      };
    }

    if (manualPasswordHash) {
      user.password = manualPasswordHash;
    }

    await user.save();

    return NextResponse.json({
      user: mapUser(user),
      issuedCredential,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId } = await parseUserIdFromRequest(request, params);
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
