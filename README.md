<div align="center">
  <img src="strix-dashboard/public/logo.svg" width="100%" alt="Project Strix Logo" />
  <h1>Project Strix</h1>
  <p><strong>Autonomous AI Pentesting Dashboard & Orchestrator</strong></p>
</div>

> [!CAUTION]
> **Authorized Use Only**
> Project Strix is a powerful offensive security tool designed to identify critical vulnerabilities using autonomous AI agents. Do not run this software against targets you do not own or do not have explicit, documented permission to test.

Project Strix is the official enterprise-grade **Autonomous Web Dashboard** and orchestration layer for the Strix AI Pentesting engine. 

Instead of relying on static payloads and predictable regex matching, Strix leverages cutting-edge Large Language Models (such as OpenAI GPT-4o, Anthropic Claude 3.5, or local Ollama instances) to dynamically reason, explore, and attack web applications exactly like a human red-team operator.

---

##  Key Capabilities

- **Autonomous Agent Exploration**: The AI engine actively reads DOMs, API responses, and minified JS files, mapping out business logic to find complex flaws like IDORs and broken access controls.
- **Real-Time Intelligence Stream**: Watch the AI's internal terminal logs and thoughts stream live to your browser via Server-Sent Events (SSE).
- **Intelligent Resumption**: If a massive scan fails due to network drops or LLM rate limits, resume it instantly from the exact point of failure—even overriding the underlying AI model mid-scan.
- **Enterprise UI & Analytics**: A beautiful dark-themed Next.js dashboard featuring dynamic Recharts for severity distribution and strict Role-Based Access Control (RBAC).

> [!NOTE]
> **Full Documentation**
> For detailed guides on Installation, System Architecture, and API configuration, please visit our official documentation site: **[Strix Official Documentation](https://infat0x.github.io/ProjectStrix/)**

---

##  Deployment (Self-Healing Auto-Deployer)

We provide a robust Python orchestration script that automatically handles system dependencies, PostgreSQL database provisioning, PM2 daemonization, and Next.js building on any fresh Ubuntu/Debian server.

> [!WARNING]
> **Port Configuration**
> By default, the auto-deployer will bind the Strix Dashboard to port `48080`. Ensure this port is permitted through your cloud provider's firewall (e.g., AWS Security Groups or UFW).

```bash
# Clone the repository
git clone https://github.com/infat0x/ProjectStrix.git
cd ProjectStrix

# Run the global orchestrator
sudo python3 runner/deploy.py
```

> [!IMPORTANT]
> The deployment script is completely idempotent. If your `dpkg` is locked or your OS is missing essential `locales` (which often breaks Postgres), the script will automatically self-heal the operating system before continuing.

---

##  Repository Structure

- `strix-dashboard/` — The Next.js Web Application (React, Tailwind CSS, Prisma ORM).
- `strix/` — The Python-based AI agent core and CLI executable.
- `docs/` — The VitePress documentation source files (auto-deployed to GitHub pages).
- `runner/deploy.py` — The unified installation, self-healing, and update orchestrator.
- `runner/nuke.py` — Script to completely clean the environment and uninstall Strix.

---

##  Contributing

> [!TIP]
> **Design Philosophy**
> If you are contributing to the UI or Documentation, remember that we strictly use a "Red Team / Hacker" aesthetic. Use Crimson/Dark themes, Consolas fonts, and glassmorphic UI elements.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AgentUpdate`).
3. Commit your changes (`git commit -m 'Add new payload capabilities'`).
4. Push to the branch (`git push origin feature/AgentUpdate`).
5. Open a Pull Request.

---
<div align="center">
  <i>Developed for next-generation security validation.</i>
</div>
