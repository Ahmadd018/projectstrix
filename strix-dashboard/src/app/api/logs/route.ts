import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
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
    return NextResponse.json(
      { error: "Failed to read logs", details: String(err) },
      { status: 500 },
    );
  }
}
