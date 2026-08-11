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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await createUser(username, password);
    
    // Auto-login after registration only if approved (e.g. first user/admin)
    if (user.status === "APPROVED") {
      await createSession(user.id, user.username, user.role);
    }

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
