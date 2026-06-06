import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import { getConfig } from "@project-minato/config";
import { systemPrompt } from "./system-prompt";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    "X-Title": "MinatoWorker_Dev",
  }
});

export async function generateMetadataFromRelease(releaseData: string): Promise<string> {
  const { provider, model, ollamaUrl, reasoning } = getConfig().workers.aiRepair;

  const aiModel = provider === "ollama"
    ? createOllama({ baseURL: `${ollamaUrl}/api` })(model)
    : openrouter.languageModel(model);

  let providerOptions;
  if (provider === "ollama") {
    providerOptions = { ollama: { think: reasoning } };
  } else if (!reasoning) {
    providerOptions = { openrouter: { reasoning: { effort: "none" } } };
  }

  const { text } = await generateText({
    model: aiModel,
    system: systemPrompt,
    prompt: releaseData,
    providerOptions,
  });

  return text;
}