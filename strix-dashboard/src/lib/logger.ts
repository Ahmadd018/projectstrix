import fs from "fs";
import path from "path";

// Centralized logger for Strix API
// All logs are prefixed with [STRIX] and timestamp for easy grep/filtering

const LOG_LEVEL = process.env.LOG_LEVEL || "debug"; // 'debug' | 'info' | 'error'

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

// Ensure log dir exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  console.error("Failed to create log directory:", e);
}

function ts() {
  return new Date().toISOString();
}

function writeLog(level: string, tag: string, msg: string, data?: string) {
  const line = `[STRIX][${level}][${ts()}][${tag}] ${msg} ${data || ""}\n`;
  if (level === "ERROR") {
    console.error(line.trim());
  } else if (level === "WARN") {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }

  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
}

export const log = {
  info: (tag: string, msg: string, data?: object) => {
    writeLog("INFO", tag, msg, data ? JSON.stringify(data) : "");
  },
  debug: (tag: string, msg: string, data?: object) => {
    if (LOG_LEVEL === "debug") {
      writeLog("DEBUG", tag, msg, data ? JSON.stringify(data) : "");
    }
  },
  warn: (tag: string, msg: string, data?: object) => {
    writeLog("WARN", tag, msg, data ? JSON.stringify(data) : "");
  },
  error: (tag: string, msg: string, err?: unknown) => {
    const errMsg =
      err instanceof Error ? `${err.message}\n${err.stack}` : String(err ?? "");
    writeLog("ERROR", tag, msg, errMsg);
  },
};
