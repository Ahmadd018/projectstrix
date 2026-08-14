/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically executed by Next.js when the server starts.
 * We use it to start the embedded scheduler daemon.
 * 
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js runtime (server-side), not Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const fs = await import("fs");
      fs.appendFileSync("/tmp/strix-scheduler.log", new Date().toISOString() + " - instrumentation.ts register() called\n");
    } catch(e) {}
    const { startScheduler } = await import("./lib/schedulerDaemon");
    startScheduler();
  }
}
