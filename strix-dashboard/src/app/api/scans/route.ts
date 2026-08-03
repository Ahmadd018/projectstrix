import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { registerProcess, removeProcess } from "@/lib/scanStore";
import { log } from "@/lib/logger";

const RUNS_DIR = path.join(process.cwd(), "strix_runs");

function getStrixCommand(): string {
  if (process.env.STRIX_PATH && fs.existsSync(process.env.STRIX_PATH)) {
    log.debug("STRIX_CMD", `Using STRIX_PATH env: ${process.env.STRIX_PATH}`);
    return process.env.STRIX_PATH;
  }
  const home = process.env.HOME || "/root";
  const candidates = [
    "/usr/local/bin/strix",
    path.join(home, ".local/bin/strix"),
    path.join(process.cwd(), "../strix-venv/bin/strix"),
    path.join(process.cwd(), "../venv/bin/strix"),
    path.join(process.cwd(), "../strix/venv/bin/strix"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      log.debug("STRIX_CMD", `Found strix at: ${c}`);
      return c;
    }
  }
  log.warn(
    "STRIX_CMD",
    "strix not found in any candidate path, falling back to PATH lookup",
    { candidates },
  );
  return "strix";
}

function ensureRunsDir() {
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    log.info("RUNS_DIR", `Created strix_runs directory at ${RUNS_DIR}`);
  }
}

// GET /api/scans — list all scans
export async function GET() {
  log.debug("GET /api/scans", "Listing all scans", { runsDir: RUNS_DIR });
  ensureRunsDir();
  try {
    const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    log.debug("GET /api/scans", `Found ${dirs.length} scan directories`);

    const scans = dirs
      .map((e) => {
        const runFile = path.join(RUNS_DIR, e.name, "run.json");
        if (!fs.existsSync(runFile)) {
          log.debug("GET /api/scans", `Skipping ${e.name} — no run.json`);
          return null;
        }
        try {
          const data = JSON.parse(fs.readFileSync(runFile, "utf-8"));
          const vulnFile = path.join(RUNS_DIR, e.name, "vulnerabilities.json");
          let vulnCount = 0;
          if (fs.existsSync(vulnFile)) {
            try {
              const vulns = JSON.parse(fs.readFileSync(vulnFile, "utf-8"));
              vulnCount = Array.isArray(vulns) ? vulns.length : 0;
            } catch (e2) {
              log.warn(
                "GET /api/scans",
                `Failed to parse vulnerabilities.json for ${e.name}`,
                { err: String(e2) },
              );
            }
          }
          log.debug(
            "GET /api/scans",
            `Scan ${e.name}: status=${data.status} vulns=${vulnCount}`,
          );
          return { ...data, vulnCount };
        } catch (e2) {
          log.error(
            "GET /api/scans",
            `Failed to parse run.json for ${e.name}`,
            e2,
          );
          return null;
        }
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

    log.info("GET /api/scans", `Returning ${scans.length} scans`);
    return NextResponse.json({ scans });
  } catch (err) {
    log.error("GET /api/scans", "Failed to list scans directory", err);
    return NextResponse.json(
      { scans: [], error: "Failed to list scans" },
      { status: 200 },
    );
    // NOTE: returns 200 with empty scans so UI doesn't hang on error
  }
}

// POST /api/scans — start a new scan
export async function POST(req: NextRequest) {
  log.info("POST /api/scans", "New scan request received");
  const body = await req.json();
  const { target, llmModel, apiKey, scanMode, instruction } = body;

  log.debug("POST /api/scans", "Scan parameters", {
    target,
    llmModel,
    scanMode,
    instruction: instruction ? "(provided)" : "(none)",
    apiKey: apiKey ? "(provided)" : "(MISSING)",
  });

  if (!target) {
    log.warn("POST /api/scans", "Rejected: target is required");
    return NextResponse.json({ error: "target is required" }, { status: 400 });
  }
  if (!apiKey) {
    log.warn("POST /api/scans", "Rejected: apiKey is required");
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const scanId = randomUUID();
  const scanDir = path.join(RUNS_DIR, scanId);
  fs.mkdirSync(scanDir, { recursive: true });

  const logFile = path.join(scanDir, "log.txt");
  const runFile = path.join(scanDir, "run.json");
  const vulnFile = path.join(scanDir, "vulnerabilities.json");

  const runMeta = {
    id: scanId,
    target,
    llmModel: llmModel || "openai/gpt-4o",
    scanMode: scanMode || "standard",
    instruction: instruction || "",
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
  };
  fs.writeFileSync(runFile, JSON.stringify(runMeta, null, 2));
  fs.writeFileSync(vulnFile, JSON.stringify([], null, 2));
  log.info("POST /api/scans", `Scan created`, { scanId, scanDir });

  const strixCmd = getStrixCommand();
  const args = ["--target", target, "--non-interactive"];
  if (scanMode) args.push("--scan-mode", scanMode);
  if (instruction?.trim()) args.push("--instruction", instruction.trim());

  const env = {
    ...process.env,
    PATH: `${process.env.PATH || ""}:/usr/local/bin:${process.env.HOME || ""}/.local/bin`,
    STRIX_LLM: llmModel || "openai/gpt-4o",
    LLM_API_KEY: apiKey,
    OPENAI_API_KEY: apiKey,
    ANTHROPIC_API_KEY: apiKey,
    GEMINI_API_KEY: apiKey,
  };

  log.info("POST /api/scans", `Spawning strix process`, {
    cmd: strixCmd,
    args,
  });

  let proc;
  try {
    proc = spawn(strixCmd, args, { env, cwd: process.cwd(), detached: false });
    log.info("POST /api/scans", `Process spawned`, { pid: proc.pid, scanId });
  } catch (err: any) {
    log.error(
      "POST /api/scans",
      `Failed to spawn strix (ENOENT likely — not installed)`,
      err,
    );
    log.warn("POST /api/scans", "Falling back to DEMO mode");
    runMockScan(scanId, scanDir, runFile, vulnFile, logFile, target);
    return NextResponse.json({ scanId, status: "running", mode: "demo" });
  }

  registerProcess(scanId, proc);

  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  proc.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    logStream.write(chunk);
    log.debug(
      "PROC_STDOUT",
      `[${scanId.slice(0, 8)}] ${text.slice(0, 200).trim()}`,
    );
    parseVulnFromLog(text, vulnFile, scanId);
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    logStream.write(`[stderr] ${text}`);
    log.warn(
      "PROC_STDERR",
      `[${scanId.slice(0, 8)}] ${text.slice(0, 500).trim()}`,
    );
  });

  proc.on("close", (code: number | null) => {
    logStream.end();
    removeProcess(scanId);
    const updated = JSON.parse(fs.readFileSync(runFile, "utf-8"));
    updated.status =
      code === 0 ? "completed" : code === null ? "stopped" : "failed";
    updated.finishedAt = new Date().toISOString();
    updated.exitCode = code;
    fs.writeFileSync(runFile, JSON.stringify(updated, null, 2));
    log.info("PROC_CLOSE", `Scan ${scanId.slice(0, 8)} finished`, {
      exitCode: code,
      status: updated.status,
    });
  });

  proc.on("error", (err: Error) => {
    log.error(
      "PROC_ERROR",
      `Process error for scan ${scanId.slice(0, 8)}`,
      err,
    );
    logStream.write(`[error] ${err.message}\n`);
    logStream.end();
    removeProcess(scanId);
    const updated = JSON.parse(fs.readFileSync(runFile, "utf-8"));
    updated.status = "failed";
    updated.finishedAt = new Date().toISOString();
    fs.writeFileSync(runFile, JSON.stringify(updated, null, 2));
    log.warn("PROC_ERROR", "Falling back to DEMO mode after process error");
    runMockScan(scanId, scanDir, runFile, vulnFile, logFile, target);
  });

  return NextResponse.json({ scanId, status: "running" });
}

function parseVulnFromLog(text: string, vulnFile: string, scanId: string) {
  const vulnPattern = /\[VULNERABILITY\]\s*({[\s\S]*?})/g;
  let match;
  while ((match = vulnPattern.exec(text)) !== null) {
    try {
      const vuln = JSON.parse(match[1]);
      let existing: any[] = [];
      try {
        existing = JSON.parse(fs.readFileSync(vulnFile, "utf-8"));
      } catch {}
      if (!existing.find((v: any) => v.id === vuln.id)) {
        existing.push(vuln);
        fs.writeFileSync(vulnFile, JSON.stringify(existing, null, 2));
        log.info(
          "VULN_PARSER",
          `New vulnerability found for scan ${scanId.slice(0, 8)}`,
          {
            id: vuln.id,
            title: vuln.title,
            severity: vuln.severity,
          },
        );
      }
    } catch (e) {
      log.warn("VULN_PARSER", "Failed to parse vulnerability from log", {
        err: String(e),
      });
    }
  }
}

function runMockScan(
  scanId: string,
  scanDir: string,
  runFile: string,
  vulnFile: string,
  logFile: string,
  target: string,
) {
  log.info("MOCK_SCAN", `Starting mock scan for ${target}`, {
    scanId: scanId.slice(0, 8),
  });

  const mockVulns = [
    {
      id: "v1",
      title: "SQL Injection in /api/login",
      severity: "critical",
      endpoint: "/api/login",
      method: "POST",
      description:
        "The login endpoint is vulnerable to SQL injection via the username parameter.",
      poc: "username=admin' OR 1=1--&password=x",
      cvss: 9.8,
      remediation: "Use parameterized queries or prepared statements.",
    },
    {
      id: "v2",
      title: "Reflected XSS in Search",
      severity: "high",
      endpoint: "/search",
      method: "GET",
      description:
        "The q parameter is reflected without sanitization, allowing script injection.",
      poc: "/search?q=<script>alert(1)</script>",
      cvss: 7.4,
      remediation:
        "Encode all user-supplied data before rendering in HTML context.",
    },
    {
      id: "v3",
      title: "IDOR on /api/users/{id}",
      severity: "high",
      endpoint: "/api/users/{id}",
      method: "GET",
      description:
        "Any authenticated user can read any other user profile by changing the ID.",
      poc: "GET /api/users/1 with any valid JWT",
      cvss: 7.1,
      remediation:
        "Enforce ownership checks server-side for all resource access.",
    },
    {
      id: "v4",
      title: "Missing Rate Limiting on /api/auth",
      severity: "medium",
      endpoint: "/api/auth",
      method: "POST",
      description: "No rate limiting allows brute-force credential attacks.",
      poc: "Send 1000 requests/min with no throttling",
      cvss: 5.3,
      remediation:
        "Implement rate limiting and account lockout after failed attempts.",
    },
    {
      id: "v5",
      title: "Exposed Debug Endpoint",
      severity: "low",
      endpoint: "/debug/config",
      method: "GET",
      description:
        "Configuration details including environment variables are exposed.",
      poc: "GET /debug/config returns full server config",
      cvss: 3.1,
      remediation: "Disable or restrict debug endpoints in production.",
    },
  ];

  const logs = [
    `[${new Date().toISOString()}] Starting Strix security assessment (DEMO MODE)`,
    `[${new Date().toISOString()}] Target: ${target}`,
    `[${new Date().toISOString()}] Initializing reconnaissance agent...`,
    `[${new Date().toISOString()}] Crawling target endpoints...`,
    `[${new Date().toISOString()}]  Discovered 24 endpoints`,
    `[${new Date().toISOString()}] Spawning exploitation agents...`,
    `[${new Date().toISOString()}] Testing for injection vulnerabilities...`,
    `[${new Date().toISOString()}] CRITICAL: SQL Injection found at /api/login`,
    `[${new Date().toISOString()}] Testing for XSS vulnerabilities...`,
    `[${new Date().toISOString()}] ️ HIGH: Reflected XSS found in /search`,
    `[${new Date().toISOString()}] Testing for access control issues...`,
    `[${new Date().toISOString()}] ️ HIGH: IDOR vulnerability found at /api/users/{id}`,
    `[${new Date().toISOString()}] Testing rate limiting...`,
    `[${new Date().toISOString()}]  MEDIUM: No rate limiting on /api/auth`,
    `[${new Date().toISOString()}] Checking for exposed endpoints...`,
    `[${new Date().toISOString()}]  LOW: Debug endpoint exposed at /debug/config`,
    `[${new Date().toISOString()}] Assessment complete. Found 5 vulnerabilities.`,
    `[${new Date().toISOString()}] Summary: 1 Critical, 2 High, 1 Medium, 1 Low`,
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < logs.length) {
      fs.appendFileSync(logFile, logs[i] + "\n");
      log.debug("MOCK_SCAN", `[${scanId.slice(0, 8)}] ${logs[i]}`);
      if (i === 7) {
        const v = [mockVulns[0]];
        fs.writeFileSync(vulnFile, JSON.stringify(v, null, 2));
        log.info("MOCK_SCAN", "Added vuln: SQL Injection");
      }
      if (i === 9) {
        const v = mockVulns.slice(0, 2);
        fs.writeFileSync(vulnFile, JSON.stringify(v, null, 2));
        log.info("MOCK_SCAN", "Added vuln: Reflected XSS");
      }
      if (i === 11) {
        const v = mockVulns.slice(0, 3);
        fs.writeFileSync(vulnFile, JSON.stringify(v, null, 2));
        log.info("MOCK_SCAN", "Added vuln: IDOR");
      }
      if (i === 13) {
        const v = mockVulns.slice(0, 4);
        fs.writeFileSync(vulnFile, JSON.stringify(v, null, 2));
        log.info("MOCK_SCAN", "Added vuln: Missing Rate Limit");
      }
      if (i === 15) {
        fs.writeFileSync(vulnFile, JSON.stringify(mockVulns, null, 2));
        log.info("MOCK_SCAN", "Added all 5 vulnerabilities");
      }
      i++;
    } else {
      clearInterval(interval);
      const updated = JSON.parse(fs.readFileSync(runFile, "utf-8"));
      updated.status = "completed";
      updated.finishedAt = new Date().toISOString();
      updated.exitCode = 0;
      fs.writeFileSync(runFile, JSON.stringify(updated, null, 2));
      log.info("MOCK_SCAN", `Mock scan ${scanId.slice(0, 8)} completed`, {
        totalVulns: mockVulns.length,
      });
    }
  }, 1500);
}
