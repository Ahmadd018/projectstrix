import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  // H-3: authoritative admin check (middleware trusts the JWT; this re-checks the
  // live role from the DB so a demoted admin is denied immediately).
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const LOG_FILE = path.join(process.cwd(), "logs", "app.log");

  try {
    if (!fs.existsSync(LOG_FILE)) {
      return NextResponse.json({ logs: ["No logs available yet."] });
    }

    // Read the last 50KB of logs to avoid memory issues with huge files
    const stats = fs.statSync(LOG_FILE);
    const maxReadSize = 50 * 1024;
    const startPosition = Math.max(0, stats.size - maxReadSize);

    const stream = fs.createReadStream(LOG_FILE, {
      start: startPosition,
      encoding: "utf-8",
    });

    let data = "";
    for await (const chunk of stream) {
      data += chunk;
    }

    // Split by newlines and maybe remove the first line if it's cut off
    const lines = data.split("\n");
    if (startPosition > 0 && lines.length > 1) {
      lines.shift();
    }

    // Return the last 500 lines
    const lastLines = lines.filter((l) => l.trim().length > 0).slice(-500);

    return NextResponse.json({ logs: lastLines });
  } catch (err) {
    // L-4: don't leak internal error details/paths to the client.
    return NextResponse.json({ error: "Failed to read logs" }, { status: 500 });
  }
}
