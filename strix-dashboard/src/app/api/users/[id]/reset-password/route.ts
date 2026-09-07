import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";

// POST /api/users/[id]/reset-password — an admin sets a new password for another
// user (the "forgot password" resolution). Body: { newPassword }.
//
// The admin types the new password so they know it to hand to the user verbally.
// Bumps tokenVersion so any of the target user's existing sessions are revoked,
// and marks any PENDING reset request for that user as RESOLVED.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    // Same enterprise password policy as self-service change-password.
    if (newPassword.length < 12) {
      return NextResponse.json({ error: "New password must be at least 12 characters long" }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain at least one uppercase letter, one lowercase letter, and one number" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Super Admin protection: the primary 'admin' account cannot be reset by
    // anyone else — it manages its own password via change-password. This blocks
    // account takeover of the superadmin by a secondary admin.
    if (targetUser.username === "admin" && session.username !== "admin") {
      return NextResponse.json({ error: "The primary 'admin' user (Super Admin) cannot be reset by another admin" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      // Set the new hash and revoke all of the target user's existing sessions.
      prisma.user.update({
        where: { id },
        data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
      }),
      // Resolve any pending reset request(s) for this user.
      prisma.passwordResetRequest.updateMany({
        where: { userId: id, status: "PENDING" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: session.username },
      }),
    ]);

    log.info("RESET_PASSWORD", `Admin ${session.username} reset password for user: ${targetUser.username}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    log.error("RESET_PASSWORD", "Error resetting password", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
