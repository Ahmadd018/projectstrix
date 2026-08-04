# Project Strix 🦅

Strix — AI-powered Security Assessment Tool & Interactive Dashboard.

## Quick Start (One-Line Setup)

Clone the repository and run the setup script:

```bash
git clone https://github.com/your-org/ProjectStrix.git
cd ProjectStrix
bash setup_and_run.sh
```

This script will automatically:
1. Install system dependencies (Docker, Python 3, Node.js 20).
2. Install the **Strix CLI** system-wide (or in user/venv path).
3. Install Dashboard dependencies and build Next.js production bundle.

---

## Running the Dashboard

After running `setup_and_run.sh`:

### Option A: From root folder
```bash
npm start
```

### Option B: From dashboard directory
```bash
cd strix-dashboard
npm start
```

### Option C: Development mode
```bash
cd strix-dashboard
npm run dev
```

### Option D: Auto-start with setup
```bash
bash setup_and_run.sh --start
```

The dashboard will be available at **`http://localhost`** (port 80).

---

## 🛠️ CLI Usage (Independent)

You can also use the Strix CLI directly:

```bash
strix --target https://example.com --scan-mode standard
```

---

## 📁 Repository Structure

* `strix/` — Core Python-based AI agent pentesting framework & CLI.
* `strix-dashboard/` — Modern Next.js web application dashboard.
  * `strix-dashboard/scripts/` — Auxiliary background scripts (e.g., `scheduler.js`).
* `docs/` — Documentation and examples (e.g., sample report outputs).
* `setup_and_run.sh` — Automatic setup script for cloned repositories.
* `package.json` — Root scripts for building and launching.

> **Note on Background Services**: The Strix deployment utilizes PM2 to keep both the Next.js dashboard (`strix-dashboard`) and the scheduled scans process (`strix-scheduler`) running in the background continuously.
