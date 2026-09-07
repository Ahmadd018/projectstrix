// Shared LLM model catalog — the single source of truth for model pickers.
// Imported by the New Scan page and the ASM page.
export interface LlmModel { value: string; label: string; }

export const LLM_MODELS: LlmModel[] = [
  // OpenAI
  { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { value: "openai/o1-preview", label: "OpenAI o1-Preview" },
  { value: "openai/gpt-5", label: "OpenAI GPT-5" },
  { value: "openai/gpt-5.3-codex", label: "OpenAI GPT-5.3 Codex" },
  { value: "openai/gpt-5.4", label: "OpenAI GPT-5.4" },
  { value: "openai/gpt-5.5", label: "OpenAI GPT-5.5" },
  { value: "openai/gpt-5.5-pro", label: "OpenAI GPT-5.5 Pro" },
  { value: "openai/gpt-5.6", label: "OpenAI GPT-5.6" },
  { value: "openai/gpt-5.6-luna", label: "OpenAI GPT-5.6 Luna" },
  { value: "openai/gpt-5.6-terra", label: "OpenAI GPT-5.6 Terra" },
  { value: "openai/gpt-5.6-sol", label: "OpenAI GPT-5.6 Sol" },
  // Anthropic
  { value: "anthropic/claude-3-5-sonnet-latest", label: "Anthropic Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-5-haiku-latest", label: "Anthropic Claude 3.5 Haiku" },
  { value: "anthropic/claude-3-opus-latest", label: "Anthropic Claude 3 Opus" },
  { value: "anthropic/claude-sonnet-4-6", label: "Anthropic Claude 4.6 Sonnet" },
  { value: "anthropic/claude-opus-4-8", label: "Anthropic Claude 4.8 Opus" },
  { value: "anthropic/claude-sonnet-5", label: "Anthropic Claude 5 Sonnet" },
  { value: "anthropic/claude-opus-5", label: "Anthropic Claude 5 Opus" },
  { value: "anthropic/claude-fable-5", label: "Anthropic Claude 5 Fable" },
  // Google
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
  { value: "google/gemini-3-pro", label: "Google Gemini 3 Pro" },
  { value: "gemini/gemini-3.1-pro-preview", label: "Google Gemini 3.1 Pro (Preview)" },
  { value: "gemini/gemini-3.6-flash", label: "Google Gemini 3.6 Flash" },
  // Vertex AI
  { value: "vertex_ai/gemini-3.1-pro-preview", label: "Vertex AI Gemini 3.1 Pro" },
  // DeepSeek
  { value: "deepseek/deepseek-coder", label: "DeepSeek Coder" },
  { value: "deepseek/deepseek-v3", label: "DeepSeek v3" },
  { value: "deepseek/deepseek-v4-pro", label: "DeepSeek v4 Pro" },
  { value: "deepseek/deepseek-v4-flash", label: "DeepSeek v4 Flash" },
  // Groq
  { value: "groq/llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B" },
  { value: "groq/llama3-70b-8192", label: "Groq Llama 3 70B" },
  { value: "groq/mixtral-8x7b-32768", label: "Groq Mixtral 8x7B" },
  // OpenRouter
  { value: "openrouter/auto", label: "OpenRouter Auto (Best Model)" },
  { value: "openrouter/free", label: "OpenRouter Free (Auto-Select Free)" },
  { value: "openrouter/anthropic/claude-3.5-sonnet", label: "OpenRouter Claude 3.5 Sonnet" },
  { value: "openrouter/meta-llama/llama-3.3-70b-instruct", label: "OpenRouter Llama 3.3 70B" },
  { value: "openrouter/qwen/qwen-2.5-72b-instruct", label: "OpenRouter Qwen 2.5 72B (Paid)" },
  { value: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free", label: "OpenRouter Nemotron 3 Ultra 550B (Free)" },
  { value: "openrouter/inclusionai/ling-3.0-flash:free", label: "OpenRouter Ling 3.0 Flash (Free)" },
  { value: "openrouter/google/gemma-4-31b-it:free", label: "OpenRouter Gemma 4 31B (Free)" },
  { value: "openrouter/google/gemma-4-26b-a4b-it:free", label: "OpenRouter Gemma 4 26B (Free)" },
  { value: "openrouter/cohere/north-mini-code:free", label: "OpenRouter Cohere North Mini Code (Free)" },
  { value: "openrouter/openai/gpt-oss-20b:free", label: "OpenRouter GPT-OSS 20B (Free)" },
  { value: "openrouter/nvidia/nemotron-3-nano-30b-a3b:free", label: "OpenRouter Nemotron 3 Nano 30B (Free)" },
  { value: "openrouter/nvidia/nemotron-nano-12b-v2-vl:free", label: "OpenRouter Nemotron Nano 12B V2 (Free)" },
  { value: "openrouter/nvidia/nemotron-nano-9b-v2:free", label: "OpenRouter Nemotron Nano 9B (Free)" },
  { value: "openrouter/poolside/laguna-s-2.1:free", label: "OpenRouter Poolside Laguna S 2.1 (Free)" },
  { value: "openrouter/poolside/laguna-xs-2.1:free", label: "OpenRouter Poolside Laguna XS 2.1 (Free)" },
  { value: "openrouter/nvidia/nemotron-3-super-120b-a12b:free", label: "OpenRouter Nemotron 3 Super 120B (Free)" },
  { value: "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "OpenRouter Nemotron 3 Nano Omni (Free)" },
  { value: "openrouter/nvidia/nemotron-3.5-content-safety:free", label: "OpenRouter Nemotron 3.5 Content Safety (Free)" },
  // Mistral
  { value: "mistral/mistral-large-3", label: "Mistral Large 3 (675B MoE)" },
  { value: "mistral/ministral-3-14b", label: "Ministral 3 14B (Reasoning)" },
  { value: "mistral/shieldstral-3b", label: "Shieldstral (3B)" },
  { value: "mistral/mistral-large-latest", label: "Mistral Large" },
  { value: "mistral/mistral-medium-latest", label: "Mistral Medium" },
  { value: "mistral/mistral-small-latest", label: "Mistral Small" },
  { value: "mistral/open-mixtral-8x22b", label: "Mistral 8x22B" },
  { value: "mistral/open-mixtral-8x7b", label: "Mistral 8x7B" },
  // Cohere
  { value: "cohere/command-r-plus", label: "Cohere Command R+" },
  // DashScope
  { value: "dashscope/qwen3.7-max-2026-06-08", label: "Qwen 3.7 Max" },
  { value: "dashscope/qwen3.8-max", label: "Qwen 3.8 Max" },
  // Moonshot
  { value: "moonshot/kimi-k2.7-code", label: "Kimi k2.7 Code" },
  { value: "moonshot/kimi-k3", label: "Kimi k3" },
  // Local (Ollama)
  { value: "ollama/llama3.1:70b", label: "Local: Llama 3.1 70B (Ollama)" },
  { value: "ollama/qwen2.5:72b", label: "Local: Qwen 2.5 72B (Ollama)" },
  { value: "ollama/deepseek-v3", label: "Local: DeepSeek v3 (Ollama)" },
];
