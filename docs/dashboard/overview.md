# Dashboard Overview

The Strix Dashboard is the central command center for all your penetration testing operations. Built entirely with Next.js App Router and React, it provides a seamless, modern, and highly responsive user experience.

## Design Philosophy

The dashboard embraces a "glassmorphic" aesthetic with a dark theme by default, ensuring that it is comfortable on the eyes during long security assessments. The layout is designed to prioritize data visibility—bringing the most critical security metrics directly to the forefront.

## Key Sections

### 1. Global Navigation Bar
Located on the left side (or top on mobile devices), the global navigation menu gives you quick access to:
- **Overview:** The main landing page with aggregate analytics.
- **Scans:** The central hub for creating, resuming, and managing vulnerability scans.
- **Settings:** Configuration for API keys and UI preferences.
- *(Admin Only)* **System Logs:** Live logs of the Strix backend and scheduler operations.

### 2. Analytics & Metrics Header
At the top of the Overview page, you will find high-level statistics:
- **Total Scans:** The number of scans conducted over the lifetime of the application.
- **Active Scans:** How many agents are currently running.
- **Security Score:** An aggregate metric calculated based on the severity and frequency of discovered vulnerabilities across all your assets.

### 3. Vulnerability Distribution Charts
Using the Recharts library, the dashboard provides dynamic visual representations of your security posture. You can instantly see the ratio of Critical, High, Medium, and Low vulnerabilities discovered across all your projects.

## Real-Time Reactivity
Strix uses WebSockets and Server-Sent Events (SSE) heavily. This means you **never** need to refresh the page. As soon as a scan finishes, or an agent discovers a vulnerability, the dashboard charts and notifications will update instantly in front of your eyes.
