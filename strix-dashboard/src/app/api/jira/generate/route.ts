import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readApiKeys } from "@/lib/apiKeys";
import { buildIssueDescription } from "@/lib/jira";
import { log } from "@/lib/logger";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

// Generate the Jira report text with AI, in the required two-paragraph style.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const vulnId = body?.vulnId;
  if (!vulnId) return NextResponse.json({ error: "vulnId is required" }, { status: 400 });

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnId },
    include: { scan: { select: { target: true, userId: true } } },
  });
  if (!vuln) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  if (session.role !== "ADMIN" && vuln.scan.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId as string } });
  const keys = readApiKeys(user?.apiKeys);
  const deepseekKey = keys.deepseek;
  // Fallback to the deterministic template if no key is configured.
  const targetHost = vuln.target || vuln.scan.target;
  const fallback = buildIssueDescription({ ...vuln, scanTarget: targetHost });
  if (!deepseekKey) {
    return NextResponse.json({ description: fallback, generated: false, reason: "No DeepSeek key in Settings — used template." });
  }

  const system =
    "You are a senior application security engineer writing a SHORT vulnerability report for a Jira ticket. " +
    "Write EXACTLY two short paragraphs in plain text — no headings, no bullet points, no markdown, no code blocks, no image placeholders, no severity label, no CVSS. " +
    "Paragraph 1 (1–2 sentences max): state the vulnerability and its impact. If it involves a specific API/endpoint, name the HTTP method, the path, and the target host; otherwise describe it naturally without forcing an endpoint. " +
    "Paragraph 2 (1 sentence): must start with 'To mitigate this issue,' and give the core fix. " +
    "Be concise and specific; do not pad, repeat, or invent details not supported by the data.";

  const userMsg = [
    `Title: ${vuln.title}`,
    `Target host: ${targetHost}`,
    `HTTP method: ${vuln.method || "(n/a)"}`,
    `Endpoint/path: ${vuln.endpoint || "(n/a)"}`,
    `Severity: ${vuln.severity}`,
    `Finding details: ${vuln.description || "(none)"}`,
    `Proof of concept: ${vuln.poc || "(none)"}`,
    `Suggested remediation: ${vuln.remediation || "(none)"}`,
  ].join("\n");

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.2,
        max_tokens: 220,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `DeepSeek HTTP ${res.status}`;
      log.warn("POST /api/jira/generate", `DeepSeek error: ${msg}`);
      return NextResponse.json({ description: fallback, generated: false, reason: msg });
    }
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return NextResponse.json({ description: fallback, generated: false, reason: "Empty AI response." });
    return NextResponse.json({ description: text, generated: true });
  } catch (e: any) {
    log.warn("POST /api/jira/generate", `Could not reach DeepSeek: ${e?.message}`);
    return NextResponse.json({ description: fallback, generated: false, reason: `Could not reach DeepSeek: ${e?.message || "network error"}` });
  }
}
