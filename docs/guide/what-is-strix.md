# What is the Strix Dashboard?

**Strix Dashboard** is the official web interface and orchestration layer for the Project Strix autonomous AI penetration testing engine. While the core "Strix" engine is a Python-based CLI agent, this project provides the enterprise-grade UI, database management, and background scheduling required to run those agents at scale.

## The Problem with Traditional Scanners

Traditional vulnerability scanners (like Nessus, Acunetix, or ZAP) operate primarily on predefined signatures and payloads. They send thousands of requests and look for specific regex matches in the response. 

This approach has significant flaws:
- **High False Positives**: Without understanding the context of the application, traditional tools often flag benign behavior as vulnerabilities.
- **Inability to find Logic Flaws**: Business logic vulnerabilities (like IDOR, Privilege Escalation, or broken access controls) cannot be found using static payloads.
- **No Adaptability**: If a firewall blocks a payload, a traditional scanner gives up. It cannot "think" of a workaround.

## The Strix Solution

Strix bridges the gap between automated tools and human penetration testers. 

By integrating state-of-the-art LLMs (like OpenAI's GPT-4o, Anthropic's Claude 3.5 Sonnet, or OpenRouter variants), Strix operates as an **autonomous agent**. 

When you give Strix a target, it doesn't just run a checklist. It:
1. **Reads and comprehends** the target's HTML, JS, and APIs.
2. **Formulates a plan** based on what it sees (e.g., "I found a login page, let me look for a registration endpoint").
3. **Executes actions** using its built-in tools (crawling, injecting, API fuzzing).
4. **Analyzes the response** to determine if a vulnerability exists.
5. **Adapts its strategy** if it hits a roadblock, much like a real human hacker.

Welcome to the future of offensive security.
