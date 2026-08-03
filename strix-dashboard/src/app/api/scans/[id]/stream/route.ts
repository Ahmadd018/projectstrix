import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { log } from "@/lib/logger";

const RUNS_DIR = path.join(process.cwd(), "strix_runs");

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  log.info(`SSE /api/scans/${id}/stream`, "Client connected to SSE stream");

  const logFile = path.join(RUNS_DIR, id, "log.txt");
  const runFile = path.join(RUNS_DIR, id, "run.json");
  const vulnFile = path.join(RUNS_DIR, id, "vulnerabilities.json");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send existing log content first
      if (fs.existsSync(logFile)) {
        const existing = fs.readFileSync(logFile, "utf-8");
        const lines = existing.split("\n").filter(Boolean);
        log.debug(
          `SSE /api/scans/${id}/stream`,
          `Replaying ${lines.length} existing log lines`,
        );
        for (const line of lines) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "log", line })}\n\n`,
            ),
          );
        }
      } else {
        log.debug(
          `SSE /api/scans/${id}/stream`,
          "No log.txt yet — scan may not have started output",
        );
      }

      // If scan is already done, send completion and close
      if (fs.existsSync(runFile)) {
        try {
          const run = JSON.parse(fs.readFileSync(runFile, "utf-8"));
          const activeStatuses = ["running", "crawling", "scanning", "analyzing"];
          if (!activeStatuses.includes(run.status)) {
            log.info(
              `SSE /api/scans/${id}/stream`,
              `Scan already finished (status=${run.status}), closing SSE immediately`,
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "status", status: run.status })}\n\n`,
              ),
            );
            controller.close();
            return;
          }
        } catch (e) {
          log.error(
            `SSE /api/scans/${id}/stream`,
            "Failed to read run.json",
            e,
          );
        }
      }

      // Watch for new log lines and vulns
      let lastSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
      let lastVulnCount = 0;
      let tickCount = 0;
      let lastStatus = "running"; // Track last known status to send updates

      log.debug(
        `SSE /api/scans/${id}/stream`,
        `Starting file watch (initial log size: ${lastSize} bytes)`,
      );

      const watchInterval = setInterval(() => {
        tickCount++;

        // Heartbeat log every 30s (60 ticks * 500ms)
        if (tickCount % 60 === 0) {
          log.debug(
            `SSE /api/scans/${id}/stream`,
            `Heartbeat tick=${tickCount}, logSize=${lastSize}, vulns=${lastVulnCount}`,
          );
        }

        // Check for new log lines
        if (fs.existsSync(logFile)) {
          try {
            const stat = fs.statSync(logFile);
            if (stat.size > lastSize) {
              const fd = fs.openSync(logFile, "r");
              const buf = Buffer.alloc(stat.size - lastSize);
              fs.readSync(fd, buf, 0, buf.length, lastSize);
              fs.closeSync(fd);
              const newText = buf.toString("utf-8");
              const lines = newText.split("\n").filter(Boolean);
              log.debug(
                `SSE /api/scans/${id}/stream`,
                `New log data: ${lines.length} lines (+${stat.size - lastSize} bytes)`,
              );
              lastSize = stat.size;
              for (const line of lines) {
                try {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "log", line })}\n\n`,
                    ),
                  );
                } catch (e) {
                  log.error(
                    `SSE /api/scans/${id}/stream`,
                    "Failed to enqueue log line",
                    e,
                  );
                }
              }
            }
          } catch (e) {
            log.error(
              `SSE /api/scans/${id}/stream`,
              "Error reading log file",
              e,
            );
          }
        }

        // Check for new vulnerabilities
        if (fs.existsSync(vulnFile)) {
          try {
            const vulns = JSON.parse(fs.readFileSync(vulnFile, "utf-8"));
            if (Array.isArray(vulns) && vulns.length > lastVulnCount) {
              const newVulns = vulns.slice(lastVulnCount);
              log.info(
                `SSE /api/scans/${id}/stream`,
                `${newVulns.length} new vulnerability(ies) found`,
                {
                  titles: newVulns.map((v: any) => `${v.severity}: ${v.title}`),
                },
              );
              for (const v of newVulns) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "vulnerability", vuln: v })}\n\n`,
                  ),
                );
              }
              lastVulnCount = vulns.length;
            }
          } catch (e) {
            log.error(
              `SSE /api/scans/${id}/stream`,
              "Error reading vulnerabilities.json",
              e,
            );
          }
        }

        // Check if scan is done or status changed
        if (fs.existsSync(runFile)) {
          try {
            const run = JSON.parse(fs.readFileSync(runFile, "utf-8"));
            const activeStatuses = ["running", "crawling", "scanning", "analyzing"];
            
            // Send intermediate status changes
            if (run.status && run.status !== lastStatus) {
              lastStatus = run.status;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "status", status: run.status })}\n\n`,
                ),
              );
            }

            // End stream if finished
            if (!activeStatuses.includes(run.status)) {
              log.info(
                `SSE /api/scans/${id}/stream`,
                `Scan finished (status=${run.status}), closing SSE stream`,
                { exitCode: run.exitCode },
              );
              clearInterval(watchInterval);
              controller.close();
            }
          } catch (e) {
            log.error(
              `SSE /api/scans/${id}/stream`,
              "Error reading run.json in watch loop",
              e,
            );
          }
        }
      }, 500);

      return () => {
        log.info(
          `SSE /api/scans/${id}/stream`,
          "Client disconnected, clearing watch interval",
        );
        clearInterval(watchInterval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
