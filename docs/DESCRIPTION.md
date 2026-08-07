# Project Strix: Autonomous AI Pentesting Platform

## Overview
**Project Strix** is an advanced, enterprise-grade autonomous AI penetration testing platform. It is designed to act as an intelligent security agent that autonomously scans, analyzes, and identifies vulnerabilities in web applications, APIs, and network endpoints using state-of-the-art Large Language Models (LLMs).

Unlike traditional vulnerability scanners that rely on predefined static signatures, Strix mimics the creative and adaptive thinking of a human security researcher. It actively interacts with targets, understands complex logic flows, and dynamically adjusts its attack strategy based on the responses it receives.

## Platform Features

Project Strix provides a comprehensive suite of features distributed across its architecture, empowering both security teams and developers.

### 1. Advanced Web Dashboard (UI)
- **Modern & Responsive Design:** A fully glassmorphic, dark-themed interface built with Next.js App Router and React.
- **Interactive Data Visualization:** Real-time metrics including a dynamic Security Score, Active Scans counter, and Critical Threat highlights.
- **Analytics & Charts:** A powerful Recharts-based dashboard view that maps out vulnerability severities and scan progress trends in a clean, visual format.
- **In-App Notifications:** Real-time alert system notifying users the moment a scan completes or a critical vulnerability is found.

### 2. Autonomous Penetration Testing (Strix Core)
- **LLM Integration:** Leverages cutting-edge models (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, OpenRouter, Nemotron) for contextual vulnerability discovery.
- **Custom Scan Modes:** Supports `quick`, `standard`, and `deep` scan intensities.
- **Target Flexibility:** Can analyze Live URLs, GitHub Repositories, and local code directories.
- **Custom Instructions:** Allows users to provide natural language prompts (e.g., "Focus on IDOR vulnerabilities in the billing module").

### 3. Real-Time Scan Execution & Streaming
- **Live Terminal Emulation:** An embedded web terminal (xterm.js) streams the AI agent's internal thought process and logs in real-time using Server-Sent Events (SSE).
- **On-the-fly Findings:** Vulnerabilities populate the dashboard the exact moment the AI discovers them, complete with Severity Badges and CVSS scores.

### 4. Intelligent Scan Resumption
- **Resume Failed/Stopped Scans:** Pick up right where a scan left off by simply pasting the Previous Run ID (UUID) into the dashboard.
- **Dynamic Model Overriding:** Optionally override the LLM model during resumption, allowing you to seamlessly switch AI providers (e.g., from OpenAI to OpenRouter) if you run into rate limits mid-scan.

### 5. Enterprise-Grade Security & User Management
- **Role-Based Access Control (RBAC):** Distinct `ADMIN` and `USER` roles. Admin users get access to system-level logs and configurations.
- **Hardened Authentication:** JWT-based session management, brute-force protection (Rate Limiting), secure HTTP headers, and strict CSRF cookies.
- **System Audit Logs:** A dedicated interface for Admins to monitor who initiated scans, logged in, or encountered errors.

### 6. Reporting & Automation
- **PDF Export:** One-click generation of professional PDF reports detailing all discovered vulnerabilities, Proof of Concepts (PoC), and remediation advice.
- **Recurring Scan Scheduler:** Set up automated scans (e.g., "Run every Sunday at 3 AM") directly from the dashboard via the built-in Scheduler Daemon.
- **Interactive API Docs:** Built-in Swagger UI (`/api/docs`) for developers to programmatically trigger scans and integrate Strix into CI/CD pipelines.

### 7. Seamless & Self-Healing Deployment
- **Global Auto-Deployer:** A single `global_deploy.py` script that automatically provisions PostgreSQL, installs Node.js/PM2, clones repositories, configures environments, and builds the Next.js app on fresh Ubuntu servers in minutes.
- **Self-Healing Features:** The deployer intelligently detects and recovers from missing OS locales, interrupted `dpkg` states, and dynamically probes PostgreSQL ports to ensure a foolproof setup on minimal cloud environments (deployed on port `48080`).

## Why Strix?
In modern software development, security testing often becomes a bottleneck. Manual penetration testing is slow and expensive, while automated scanners produce high false positives and fail to understand business logic. Strix bridges this gap by combining the speed of automation with the intelligence of an AI, providing continuous and deep security validation.

## Architecture
- **Strix Core (CLI):** The Python-based intelligence engine that runs the scans.
- **Strix Dashboard:** A Next.js (App Router) web interface for managing the platform.
- **PostgreSQL:** The primary database for storing scan history, user sessions, and vulnerability data (managed via Prisma ORM).
- **Scheduler Daemon:** An embedded background service that manages recurring scans and agent orchestration.
