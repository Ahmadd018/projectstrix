import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const RUNS_DIR = path.join(process.cwd(), 'strix_runs');

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logFile = path.join(RUNS_DIR, id, 'log.txt');
  const runFile = path.join(RUNS_DIR, id, 'run.json');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send existing log content first
      if (fs.existsSync(logFile)) {
        const existing = fs.readFileSync(logFile, 'utf-8');
        if (existing) {
          const lines = existing.split('\n').filter(Boolean);
          for (const line of lines) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', line })}\n\n`));
          }
        }
      }

      // If scan is already done, send completion and close
      if (fs.existsSync(runFile)) {
        try {
          const run = JSON.parse(fs.readFileSync(runFile, 'utf-8'));
          if (run.status !== 'running') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', status: run.status })}\n\n`));
            controller.close();
            return;
          }
        } catch {}
      }

      // Watch log file for new lines
      let lastSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
      let lastVulnCount = 0;

      const watchInterval = setInterval(() => {
        // Check for new log lines
        if (fs.existsSync(logFile)) {
          const stat = fs.statSync(logFile);
          if (stat.size > lastSize) {
            const fd = fs.openSync(logFile, 'r');
            const buf = Buffer.alloc(stat.size - lastSize);
            fs.readSync(fd, buf, 0, buf.length, lastSize);
            fs.closeSync(fd);
            lastSize = stat.size;
            const newText = buf.toString('utf-8');
            const lines = newText.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', line })}\n\n`));
              } catch {}
            }
          }
        }

        // Check for new vulnerabilities
        const vulnFile = path.join(RUNS_DIR, id, 'vulnerabilities.json');
        if (fs.existsSync(vulnFile)) {
          try {
            const vulns = JSON.parse(fs.readFileSync(vulnFile, 'utf-8'));
            if (Array.isArray(vulns) && vulns.length > lastVulnCount) {
              const newVulns = vulns.slice(lastVulnCount);
              for (const v of newVulns) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'vulnerability', vuln: v })}\n\n`));
              }
              lastVulnCount = vulns.length;
            }
          } catch {}
        }

        // Check if scan is done
        if (fs.existsSync(runFile)) {
          try {
            const run = JSON.parse(fs.readFileSync(runFile, 'utf-8'));
            if (run.status !== 'running') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', status: run.status })}\n\n`));
              clearInterval(watchInterval);
              controller.close();
            }
          } catch {}
        }
      }, 500);

      // Cleanup on stream close
      return () => {
        clearInterval(watchInterval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
