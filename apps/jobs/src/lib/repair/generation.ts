import { generateText, type LanguageModel} from "ai";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { systemPrompt } from "./system-prompt";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

const MODEL_CONFIGS: Record<string, { instance: LanguageModel; providerOptions?: any }> = {
  "deepseek/deepseek-v4-flash": {
    instance: openrouter.languageModel("deepseek/deepseek-v4-flash"),
    providerOptions: { openrouter: { reasoning: { effort: "none" }, order: ["baidu/fp8", "deepinfra/fp4"] } }
  },
  "google/gemini-2.5-flash": {
    instance: openrouter.languageModel("google/gemini-2.5-flash"),
    providerOptions: { openrouter: { reasoning: { effort: "none" } } }
  },
  "qwen/qwen3-235b-a22b": {
    instance: openrouter.languageModel("qwen/qwen3-235b-a22b"),
    providerOptions: { openrouter: { reasoning: { effort: "none" } } }
  },

  "gemma3:4b":   { instance: ollama("gemma3:4b") },
  "qwen2.5:7b":  { instance: ollama("qwen2.5:7b") },
  "qwen3:8b":    { instance: ollama("qwen3:8b") },
  "qwen3:32b":   { instance: ollama("qwen3:32b") },
};

type SupportedModel = keyof typeof MODEL_CONFIGS;

export async function generateMetadataFromRelease(releaseData: string, model: SupportedModel) {
  const config = MODEL_CONFIGS[model];
  
  if (!config) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const { text } = await generateText({
    model: config.instance,
    system: systemPrompt,
    prompt: releaseData,
    providerOptions: config.providerOptions,
  });

  return text;
}