import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { isLocked, recordFailure } from "@/lib/rateLimiter";

// POST /api/auth/reset-request — a locked-out user asks an admin to reset their
// password. Unauthenticated (they can't log in). Body: { username }.
//
// Security notes:
// - Returns the same generic success whether or not the username exists, so this
//   endpoint can't be used to enumerate accounts.
// - Throttled per-username to prevent a flood of reset requests for one account.
// - Never creates a second PENDING request for the same user (idempotent).
export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== "string" || username.length < 2 || username.length > 64) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // Throttle repeated requests for the same account.
    const throttleKey = `reset-request:${username.toLowerCase()}`;
    if (isLocked(throttleKey) > 0) {
      // Same generic response — don't reveal throttling state per account.
      return NextResponse.json({ success: true });
    }
    recordFailure(throttleKey);

    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      const existing = await prisma.passwordResetRequest.findFirst({
        where: { userId: user.id, status: "PENDING" },
      });
      if (!existing) {
        await prisma.passwordResetRequest.create({ data: { userId: user.id } });
        log.info("RESET_REQUEST", `Password reset requested for user: ${user.username}`);
      }
    } else {
      log.warn("RESET_REQUEST", `Password reset requested for unknown username: ${username}`);
    }

    // Always the same response, regardless of whether the user exists.
    return NextResponse.json({ success: true });
  } catch (error: any) {
    log.error("RESET_REQUEST", "Error handling reset request", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
