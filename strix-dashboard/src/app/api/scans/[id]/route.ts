import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProcess, removeProcess } from '@/lib/scanStore';

const RUNS_DIR = path.join(process.cwd(), 'strix_runs');

function getScanDir(id: string) {
  return path.join(RUNS_DIR, id);
}

// GET /api/scans/[id] — get scan status + vulnerabilities
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scanDir = getScanDir(id);
  const runFile = path.join(scanDir, 'run.json');
  const vulnFile = path.join(scanDir, 'vulnerabilities.json');

  if (!fs.existsSync(runFile)) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  const run = JSON.parse(fs.readFileSync(runFile, 'utf-8'));
  let vulnerabilities: any[] = [];
  if (fs.existsSync(vulnFile)) {
    try { vulnerabilities = JSON.parse(fs.readFileSync(vulnFile, 'utf-8')); } catch {}
  }

  return NextResponse.json({ ...run, vulnerabilities });
}

// DELETE /api/scans/[id] — stop a running scan
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scanDir = getScanDir(id);
  const runFile = path.join(scanDir, 'run.json');

  if (!fs.existsSync(runFile)) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  const proc = getProcess(id);
  if (proc) {
    try {
      proc.kill('SIGTERM');
    } catch {}
    removeProcess(id);
  }

  const run = JSON.parse(fs.readFileSync(runFile, 'utf-8'));
  run.status = 'stopped';
  run.finishedAt = new Date().toISOString();
  fs.writeFileSync(runFile, JSON.stringify(run, null, 2));

  return NextResponse.json({ success: true });
}
