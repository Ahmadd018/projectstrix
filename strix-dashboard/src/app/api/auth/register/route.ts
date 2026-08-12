import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/authStore";
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

    // Input length and character limits
    if (typeof username !== "string" || username.length < 2 || username.length > 32) {
      return NextResponse.json({ error: "Username must be 2–32 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
      return NextResponse.json({ error: "Username may only contain letters, numbers, _ - ." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length > 256) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

  // H-3: Enterprise-grade password requirements
  if (password.length < 12) {
    return NextResponse.json(
      { error: "Password must be at least 12 characters" },
      { status: 400 }
    );
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: "Password must contain uppercase, lowercase, and a number" },
      { status: 400 }
    );
  }

    const user = await createUser(username, password);
    
    // Auto-login after registration (even if pending, so they see the lock screen)
    await createSession(user.id, user.username, user.role, user.status);

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role: user.role, status: user.status } });
  } catch (err: any) {
    if (err.message === "Username already exists") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err.message === "Variations of 'admin' are not allowed") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
