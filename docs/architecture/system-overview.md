# System Overview

Project Strix relies on a decoupled, asynchronous architecture.

- **Frontend:** Next.js App Router (React)
- **Backend:** Next.js API Routes (Node.js)
- **Database:** PostgreSQL (managed by Prisma ORM)
- **AI Core:** Python 3 (CLI Agent)
- **Scheduler:** PM2 Node.js daemon

## System Architecture Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#dc2626', 'edgeLabelBackground':'#1e1e20', 'tertiaryColor': '#1e1e20'}}}%%
graph TD
    subgraph UI["Dashboard (Next.js)"]
        A[User Browser]
        B[Dashboard Backend API]
        A <-->|SSE Stream| B
        A <-->|REST API| B
    end

    subgraph Infra["Infrastructure"]
        E[(PostgreSQL Database)]
        F[PM2 Scheduler]
    end

    subgraph Core["Strix Engine (Python)"]
        C[strix CLI Agent]
        D[LLM Reasoning Core]
        C <-->|Prompts & Tool Use| D
    end

    B -->|CRUD Scans| E
    F -->|Polls Pending Scans| E
    F -->|Spawns via child_process| C
    C -.->|Writes Logs to /tmp| B
    
    style A fill:#333,stroke:#666,stroke-width:2px,color:#fff
    style B fill:#b91c1c,stroke:#fff,stroke-width:2px,color:#008000
    style C fill:#dc2626,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#991b1b,stroke:#fff,stroke-width:2px,color:#fff
    style E fill:#0369a1,stroke:#fff,stroke-width:2px,color:#fff
    style F fill:#d97706,stroke:#fff,stroke-width:2px,color:#fff
    
    linkStyle default stroke:#888,stroke-width:2px,color:#008000
```

When a user initiates a scan from the UI, the Next.js API stores the configuration in PostgreSQL. It then uses Node's `child_process` to spawn the `strix` Python executable in the background, passing the UUID and parameters. The Python process operates entirely independently, logging its findings to temporary files, which the Node.js API streams back to the UI via Server-Sent Events.
