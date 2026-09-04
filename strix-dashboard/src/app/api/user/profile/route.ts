import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// The current user's profile identity (email + optional Jira username) used to
// set the Jira reporter when an integration opts into it.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { username: true, email: true, jiraUsername: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ username: user.username, email: user.email || "", jiraUsername: user.jiraUsername || "" });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().slice(0, 255);
  const jiraUsername = String(body?.jiraUsername || "").trim().slice(0, 100);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId as string },
    data: { email, jiraUsername },
  });
  return NextResponse.json({ success: true, email, jiraUsername });
}
