import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/authStore";
import { createSession } from "@/lib/session";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Input length limits to prevent DoS via oversized payloads
    if (typeof username !== "string" || username.length > 64 || username.length < 2) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length > 256) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    // M-2: Per-account lockout — cannot be bypassed by rotating X-Forwarded-For.
    const throttleKey = `login:${username.toLowerCase()}`;
    const lockedFor = isLocked(throttleKey);
    if (lockedFor > 0) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(lockedFor) } }
      );
    }

    const user = await verifyUser(username, password);
    if (!user) {
      recordFailure(throttleKey);
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.status === "REJECTED") {
      return NextResponse.json({ error: "Your account request was rejected." }, { status: 403 });
    }

    recordSuccess(throttleKey);
    await createSession(user.id, user.username, user.role, user.status, user.tokenVersion);

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
