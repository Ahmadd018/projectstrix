# Settings & Configuration

The Settings tab is crucial for ensuring the Strix AI agent has the permissions and credentials it needs to perform intelligence gathering and analysis.

## API Keys Configuration

Because Strix relies on commercial Large Language Models (LLMs) for its cognitive engine, you must provide your own API keys. 

In the Settings tab, you will find input fields for:
- **OpenAI API Key** (Required if using `gpt-4o` or `gpt-3.5-turbo`)
- **Anthropic API Key** (Required if using `claude-3-5-sonnet`)
- **OpenRouter API Key** (Required for accessing various open-source or gated models)

### Local Storage Security
For security and privacy reasons, **Strix does NOT store your API keys in the database.**
When you save an API key in the Settings tab, it is saved securely in your browser's `LocalStorage`. 

When you launch a scan, the Dashboard reads the keys from LocalStorage and securely injects them into the backend payload *only* for the duration of that specific scan initiation. If you log in from a different computer or a different browser, you will need to re-enter your API keys.

## Using Local Models (Ollama)
If you prefer not to use cloud-based LLMs due to data privacy concerns or costs, Strix supports local models via **Ollama**.
If you select an Ollama model during scan creation (e.g., `llama3`), the system will bypass the API key checks and attempt to connect to a local Ollama instance running on the server.
