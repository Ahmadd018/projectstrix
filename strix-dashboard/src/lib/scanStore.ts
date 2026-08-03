import { ChildProcess } from 'child_process';

// In-memory store: scanId -> ChildProcess
// This lives in the Node.js server process memory
const runningProcesses = new Map<string, ChildProcess>();

export function registerProcess(scanId: string, proc: ChildProcess) {
  runningProcesses.set(scanId, proc);
}

export function getProcess(scanId: string): ChildProcess | undefined {
  return runningProcesses.get(scanId);
}

export function removeProcess(scanId: string) {
  runningProcesses.delete(scanId);
}

export function getAllRunningIds(): string[] {
  return Array.from(runningProcesses.keys());
}
