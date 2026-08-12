import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/authStore";
import { createSession } from "@/lib/session";

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

    const user = await verifyUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.status === "REJECTED") {
      return NextResponse.json({ error: "Your account request was rejected." }, { status: 403 });
    }

    await createSession(user.id, user.username, user.role, user.status);

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
