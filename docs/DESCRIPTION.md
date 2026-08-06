# Project Strix: Autonomous AI Pentesting Platform

## Overview
**Project Strix** is an advanced, enterprise-grade autonomous AI penetration testing platform. It is designed to act as an intelligent security agent that autonomously scans, analyzes, and identifies vulnerabilities in web applications, APIs, and network endpoints using state-of-the-art Large Language Models (LLMs).

Unlike traditional vulnerability scanners that rely on predefined static signatures, Strix mimics the creative and adaptive thinking of a human security researcher. It actively interacts with targets, understands complex logic flows, and dynamically adjusts its attack strategy based on the responses it receives.

## Core Features
1. **AI-Driven Assessment:** Integrates directly with top-tier LLMs (like OpenAI GPT-4o and Anthropic Claude 3.5 Sonnet) to perform deep contextual analysis of code and application logic.
2. **Real-time Monitoring:** Provides a sleek, dark-themed Next.js dashboard where users can launch scans, monitor agent logs via Server-Sent Events (SSE) in real time, and view discovered vulnerabilities as they happen.
3. **Autonomous Navigation:** The core `strix` agent can crawl web applications, parse API documentation, and attempt sophisticated exploits like IDOR, Authentication Bypasses, and Business Logic Flaws without human intervention.
4. **Comprehensive Reporting:** Automatically generates detailed vulnerability reports including CVSS scores, Proof of Concepts (PoCs), and actionable remediation steps.
5. **Secure Architecture:** Built with security in mind, featuring Role-Based Access Control (RBAC), JWT authentication, API rate limiting, and strict security headers.

## Why Strix?
In modern software development, security testing often becomes a bottleneck. Manual penetration testing is slow and expensive, while automated scanners produce high false positives and fail to understand business logic. Strix bridges this gap by combining the speed of automation with the intelligence of an AI, providing continuous and deep security validation.

## Architecture
- **Strix Core (CLI):** The Python-based intelligence engine that runs the scans.
- **Strix Dashboard:** A Next.js (App Router) web interface for managing the platform.
- **PostgreSQL:** The primary database for storing scan history, user sessions, and vulnerability data (managed via Prisma ORM).
- **Scheduler Daemon:** An embedded background service that manages recurring scans and agent orchestration.
