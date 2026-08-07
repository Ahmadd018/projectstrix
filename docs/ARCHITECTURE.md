# Architecture & Tech Stack

Project Strix is built using a modern, scalable architecture designed for high performance, ease of use, and real-time data streaming. It combines the power of Next.js for a robust web interface with Python for the core scanning intelligence.

## System Components

### 1. Frontend (Client-Side)
- **Framework**: Next.js (App Router)
- **UI Library**: React, Shadcn UI, Radix UI
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **State Management**: React Hooks + LocalStorage for persistent local settings (e.g., API keys, notification configs)
- **Data Visualization**: Recharts for rendering the new Analytics Dashboard (displaying vulnerability severities, scan durations, and trends) replacing the old Live Graph.
- **Real-Time Logs**: `xterm.js` for an embedded live terminal streaming agent thoughts and actions.

### 2. Backend (Server-Side)
- **API Framework**: Next.js Route Handlers (`/api/*`)
- **Authentication**: Stateless JWT tokens (via `jose`) stored in HTTP-only cookies (`strix_session`).
- **Real-time Engine**: Server-Sent Events (SSE) streaming logs directly from the local file system.
- **Process Management**: Node.js `child_process.spawn` for executing the Python core scanner on demand.
- **Scan Resumption**: Intelligent API logic that dynamically fetches the previous run's metadata from the database, restores the state, and restarts the `strix` CLI using the exact configuration, with an option to override the LLM model on the fly.

### 3. Database Layer
- **Database**: PostgreSQL (Auto-deployed and dynamically configured)
- **ORM**: Prisma Client with `@prisma/adapter-pg` and Node `pg` Pool.
- **Schema**:
  - `User`: Handles authentication and RBAC (`ADMIN` vs `USER`).
  - `Scan`: Stores metadata, scheduling details, status (`running`, `scheduled`, `completed`, `failed`), and JSON payloads.

### 4. Background Scheduler
- **Technology**: Standalone Node.js script (`scripts/scheduler.js`) managed continuously by **PM2**.
- **Role**: Periodically polls the database for scans with `status="scheduled"` or recurring scans.
- **Trigger**: Authenticates via an internal bypass header (`x-scheduler-secret`) and safely invokes the Next.js API.

### 5. Strix Core (Scanner)
- **Technology**: Python (v3.10+)
- **Role**: The actual engine that performs crawling and vulnerability scanning using LLMs (GPT-4o, Claude 3.5 Sonnet, etc.). Invoked via CLI arguments (`strix -n <name>`).
- **Output Handling**: Output is piped to a local temporary directory (`/tmp/strix_runs/<uuid>`) which the Next.js API subsequently monitors for live dashboard updates via SSE.

### 6. Auto-Deployment Engine
- **Technology**: Python (`global_deploy.py`)
- **Role**: A self-healing auto-deployment script designed for minimal Ubuntu/Debian cloud servers.
- **Features**: Automatically fixes interrupted `dpkg` states, installs missing `locales`, dynamically resolves PostgreSQL ports, configures `pg_hba.conf` for secure TCP connections, and spins up the PM2 service on port `48080`.
