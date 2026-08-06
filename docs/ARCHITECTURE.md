# Architecture & Tech Stack

Project Strix is built using a modern, scalable architecture designed for high performance, ease of use, and real-time data streaming.

## System Components

### 1. Frontend (Client-Side)
- **Framework**: Next.js (App Router)
- **UI Library**: React, Shadcn UI, Radix UI
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **State Management**: React Hooks + LocalStorage for persistent local settings (e.g., API keys, notification configs)

### 2. Backend (Server-Side)
- **API Framework**: Next.js Route Handlers (`/api/*`)
- **Authentication**: Stateless JWT tokens (via `jose`) stored in HTTP-only cookies (`strix_session`).
- **Real-time Engine**: Server-Sent Events (SSE) streaming logs directly from the local file system.
- **Process Management**: Node.js `child_process.spawn` for executing the Python core scanner on demand.

### 3. Database Layer
- **Database**: PostgreSQL
- **ORM**: Prisma Client with `@prisma/adapter-pg` and Node `pg` Pool.
- **Schema**:
  - `User`: Handles authentication and RBAC (`ADMIN` vs `USER`).
  - `Scan`: Stores metadata, scheduling details (`nextRunAt`, `period`), status (`running`, `scheduled`, `completed`), and JSON payloads.

### 4. Background Scheduler
- **Technology**: Standalone Node.js script (`scripts/scheduler.js`) managed continuously by **PM2**.
- **Role**: Periodically polls the database (every 10s) for scans with `status="scheduled"` or recurring scans where `nextRunAt <= now`.
- **Trigger**: Authenticates via an internal bypass header (`x-scheduler-secret`) and safely invokes the Next.js `POST /api/scans` endpoint while preserving the original user's ownership of the scan.

### 5. Strix Core (Scanner)
- **Technology**: Python (v3.10+)
- **Role**: The actual engine that performs crawling and vulnerability scanning. Invoked via CLI arguments. Output is piped to a local temporary directory (`/tmp/strix_runs/<uuid>`) which the Next.js API subsequently monitors for live dashboard updates.
