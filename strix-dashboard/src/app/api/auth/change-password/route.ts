import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, createSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.userId as string;
    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirmation do not match" }, { status: 400 });
    }

    // Enterprise password policy check
    if (newPassword.length < 12) {
      return NextResponse.json({ error: "New password must be at least 12 characters long" }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least one uppercase letter, one lowercase letter, and one number" }, { status: 400 });
    }

    // M-2: Throttle current-password guessing on a live session.
    const throttleKey = `pw:${userId}`;
    const lockedFor = isLocked(throttleKey);
    if (lockedFor > 0) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(lockedFor) } }
      );
    }

    // Fetch user from DB
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      recordFailure(throttleKey);
      log.warn("CHANGE_PASSWORD", `Failed password change attempt for user: ${user.username}`);
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    recordSuccess(throttleKey);

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // H-3: Bump tokenVersion so every OTHER existing session is invalidated,
    // then re-issue a fresh session for this caller so they stay logged in.
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });
    await createSession(updated.id, updated.username, updated.role, updated.status, updated.tokenVersion);

    log.info("CHANGE_PASSWORD", `Password successfully changed for user: ${user.username}`);
    return NextResponse.json({ success: true, message: "Password updated successfully" });

  } catch (error: any) {
    log.error("CHANGE_PASSWORD", "Error changing password", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
