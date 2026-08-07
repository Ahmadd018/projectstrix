# Prerequisites

Before deploying Project Strix, ensure your environment meets the minimum hardware and software requirements.

## Hardware Requirements
Since Strix utilizes Next.js for the UI, PostgreSQL for the database, and an embedded Python runtime for the AI scanning engine, your server should have sufficient resources to handle concurrent tasks.

- **CPU:** 2 Cores (4 Cores recommended for parallel scanning)
- **RAM:** 4 GB minimum (8 GB recommended)
- **Storage:** 20 GB SSD

## Supported Operating Systems
The official auto-deployer is tested exclusively on Debian-based distributions:
- Ubuntu 22.04 LTS
- Ubuntu 24.04 LTS
- Debian 12

*While it may work on other Linux distributions, you will likely need to install dependencies manually.*

## API Keys
To utilize Strix's autonomous scanning capabilities, you **must** have an active API key from a supported LLM provider, such as:
- OpenAI (GPT-4o)
- Anthropic (Claude 3.5 Sonnet)
- OpenRouter (for various open-source models)

*Note: If you plan to use local models via Ollama, API keys are not required, but you must ensure your server has the hardware (GPU) to run them efficiently.*
