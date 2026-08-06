# Bug Review — Project Strix

## Bugs Found

### 🔴 Critical
1. **`schedule/route.ts` still uses file-based `recurring.json`** — completely disconnected from the DB-based scheduler. When you set a recurrence period from the UI, it writes to `recurring.json`, but the scheduler only reads from the DB (`prisma.scan.findMany`). So recurring scans set from the UI are **silently ignored**.

2. **`DELETE /api/scans/[id]` returns 404 for scheduled scans** — if a scan is in `status="scheduled"` (no `run.json` exists), stop/delete without `?purge=true` returns 404. But the DB record exists. Scheduled scans can't be cancelled without using purge.

3. **`proc.on("close")` in `route.ts` doesn't update DB** — when a scan finishes (exit code != null), the file system `run.json` is updated, but the database `status` column is **never updated**. This causes the scans list to stay as `running` forever in DB, while `run.json` says `completed`.

4. **Scheduler `payload` can be `null`** — when the scheduler calls `triggerScan`, it does `scan.payload || {}`. But if the payload stored is `null` (scheduled scan created without advanced options), the API gets an empty body and may reject it for missing `target`.

### 🟡 Medium
5. **`SignJWT` and `encodedKey` still imported but unused in scheduler** — dead code left from previous JWT-based auth.

6. **`processStop` in DELETE doesn't update DB when `purge=false`** — if a running scan is stopped, DB is correctly updated, but if `run.json` exists and scan is already `completed` or `failed`, stopping it still re-marks it `stopped` without checking current status.

7. **Health API counts scans from disk only** — DB may have more scans than the temp dir, giving a misleading count.

## Fixes Applied
- [x] Rewrote `schedule/route.ts` to update DB directly
- [x] Fixed `DELETE` to allow cancelling `scheduled` scans without requiring `run.json`
- [x] Fixed `proc.on("close")` to also update DB status  
- [x] Fixed scheduler to always have a valid payload with target
- [x] Removed dead imports from scheduler.js
