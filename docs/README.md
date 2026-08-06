# Strix Security - Documentation

Welcome to the official documentation for **Project Strix**, an advanced, AI-powered web vulnerability scanner and management dashboard.

## Overview
Project Strix consists of two main components:
1. **Strix Core**: A Python-based intelligent security scanner that crawls, analyzes, and detects vulnerabilities using LLMs.
2. **Strix Dashboard**: A modern Next.js web application for managing scans, viewing real-time logs, scheduling recurring tasks, and generating reports.

## Table of Contents
- [Architecture & Tech Stack](./ARCHITECTURE.md)
- [Installation & Setup](./INSTALLATION.md)
- [User Guide](./USER_GUIDE.md)

## Key Features
- **AI-Powered Scanning**: Integrates with multiple LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, etc.) to analyze vulnerabilities intelligently.
- **Real-Time Monitoring**: Uses Server-Sent Events (SSE) to stream live terminal logs and vulnerabilities as the scan progresses.
- **Advanced Scheduling**: Supports one-off and recurring (daily/weekly/monthly) background scans via a robust PM2-managed scheduler.
- **Role-Based Access Control (RBAC)**: Secure multi-user environment with isolated workspaces and strict Admin privileges.
- **PostgreSQL Database**: Persistent storage for all scan metadata, user accounts, and system settings via Prisma ORM.
