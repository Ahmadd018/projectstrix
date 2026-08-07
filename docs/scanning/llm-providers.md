# Supported LLM Providers

Strix is completely model-agnostic. While it relies on large language models for reasoning, you can swap out the "brain" of the agent at any time depending on your budget, privacy requirements, and the complexity of the target.

## Cloud Providers

### OpenAI (`gpt-4o`, `gpt-3.5-turbo`)
- **Pros:** Currently the most capable models for complex reasoning, tool calling, and logical deduction. Highly recommended for deep scans.
- **Cons:** Data is sent to OpenAI. Can be expensive for very large scans.

### Anthropic (`claude-3-5-sonnet`)
- **Pros:** Extremely fast and exceptionally good at understanding massive contexts (like large minified JavaScript files). Often performs as well as GPT-4o for vulnerability detection.
- **Cons:** Strict safety filters can sometimes trigger false-positive refusals when asked to generate "exploits" (though Strix's system prompts are designed to mitigate this).

### OpenRouter
- **Pros:** A unified API that grants access to dozens of models (like Meta's Llama 3, Google's Gemini, or specialized hacking models). Excellent for experimenting with cheaper or uncensored models.
- **Cons:** Performance is heavily dependent on the specific model chosen from their catalog.

## Local Providers

### Ollama
If your organization prohibits sending code or application structures to third-party cloud providers, Strix supports 100% offline, local scanning using Ollama.

- **Requirements:** Your server must have adequate RAM and a powerful GPU (e.g., Nvidia RTX 3090/4090 or A100) to run models like `llama3` or `mistral` locally with acceptable speed.
- **Setup:** Ensure the Ollama API is running and accessible (usually on `http://127.0.0.1:11434`) before launching the scan.
