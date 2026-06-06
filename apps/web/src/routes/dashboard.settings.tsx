import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

const PROFILES = ["quality", "health", "freshness"] as const;
const AI_PROVIDERS = ["openrouter", "ollama"] as const;
type AIProvider = (typeof AI_PROVIDERS)[number];

const OPENROUTER_MODEL_SUGGESTIONS = [
  "deepseek/deepseek-v4-flash",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "z-ai/glm-4-32b",
  "qwen/qwen3.5-flash-02-23",
  "anthropic/claude-3.5-haiku",
];

const OLLAMA_MODEL_SUGGESTIONS = [
  "qwen3.5:4b",
  "qwen3.5:9b",
  "ministral-3:3b",
  "ministral-3:8b",
  "gemma3:4b",
];

type FormState = {
  profile: string;
  ingestConcurrency: string;
  enrichmentConcurrency: string;
  flareSolverrUrl: string;
  proxyUrl: string;
  enabledScrapers: string;
  aiRepairProvider: AIProvider;
  aiRepairModel: string;
  aiRepairOllamaUrl: string;
  aiRepairReasoning: boolean;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-border border-b px-5 py-4">
        <h2 className="font-semibold text-foreground text-sm">{title}</h2>
        {description && (
          <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor} className="text-foreground text-sm">
          {label}
        </Label>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <div className="sm:w-64">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const config = useQuery(orpc.admin.config.get.queryOptions());
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [ollamaCheckResult, setOllamaCheckResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [proxyCheckResult, setProxyCheckResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (testUrl: string) => {
      return await client.admin.checkFlareSolverr({ url: testUrl });
    },
    onSuccess: (data) => {
      setCheckResult(data);
      if (data.success) {
        toast.success("FlareSolverr connected");
      } else {
        toast.warning(data.message);
      }
    },
    onError: (error) => {
      const message = error.message || "Failed to check FlareSolverr";
      setCheckResult({ success: false, message });
      toast.error(message);
    },
  });

  const proxyCheckMutation = useMutation({
    mutationFn: async (testUrl: string) => {
      return await client.admin.checkProxy({ url: testUrl });
    },
    onSuccess: (data) => {
      setProxyCheckResult(data);
      if (data.success) {
        toast.success(
          data.ip ? `Proxy connected — exit IP ${data.ip}` : "Proxy connected",
        );
      } else {
        toast.warning(data.message);
      }
    },
    onError: (error) => {
      const message = error.message || "Failed to check proxy";
      setProxyCheckResult({ success: false, message });
      toast.error(message);
    },
  });

  const ollamaCheckMutation = useMutation({
    mutationFn: async (testUrl: string) => {
      return await client.admin.checkOllama({ url: testUrl });
    },
    onSuccess: (data) => {
      setOllamaCheckResult(data);
      if (data.success) {
        toast.success(
          data.version
            ? `Ollama ${data.version} connected`
            : "Ollama connected",
        );
      } else {
        toast.warning(data.message);
      }
    },
    onError: (error) => {
      const message = error.message || "Failed to check Ollama";
      setOllamaCheckResult({ success: false, message });
      toast.error(message);
    },
  });

  useEffect(() => {
    if (!config.data) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = config.data.config as any;
    const next: FormState = {
      profile: c.search?.profile ?? "health",
      ingestConcurrency: String(c.workers?.ingest?.concurrency ?? 5),
      enrichmentConcurrency: String(c.workers?.enrichment?.concurrency ?? 5),
      flareSolverrUrl: c.scraper?.flareSolverrUrl ?? "",
      proxyUrl: c.scraper?.proxyUrl ?? "",
      enabledScrapers: (c.scraper?.enabledScrapers ?? []).join(", "),
      aiRepairProvider: (c.workers?.aiRepair?.provider ??
        "openrouter") as AIProvider,
      aiRepairModel: c.workers?.aiRepair?.model ?? "deepseek/deepseek-v4-flash",
      aiRepairOllamaUrl:
        c.workers?.aiRepair?.ollamaUrl ?? "http://ollama:11434",
      aiRepairReasoning: c.workers?.aiRepair?.reasoning ?? false,
    };
    setForm(next);
    setInitial(next);
  }, [config.data]);

  const dirty =
    form && initial && JSON.stringify(form) !== JSON.stringify(initial);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!form || !initial) return;
    setSaving(true);

    const updates: { key: string; value: unknown }[] = [];
    if (form.profile !== initial.profile)
      updates.push({ key: "search.profile", value: form.profile });
    if (form.ingestConcurrency !== initial.ingestConcurrency)
      updates.push({
        key: "workers.ingest.concurrency",
        value: Number(form.ingestConcurrency),
      });
    if (form.enrichmentConcurrency !== initial.enrichmentConcurrency)
      updates.push({
        key: "workers.enrichment.concurrency",
        value: Number(form.enrichmentConcurrency),
      });
    if (form.flareSolverrUrl !== initial.flareSolverrUrl)
      updates.push({
        key: "scraper.flareSolverrUrl",
        value: form.flareSolverrUrl.trim(),
      });
    if (form.proxyUrl !== initial.proxyUrl)
      updates.push({
        key: "scraper.proxyUrl",
        value: form.proxyUrl.trim() || undefined,
      });
    if (form.enabledScrapers !== initial.enabledScrapers)
      updates.push({
        key: "scraper.enabledScrapers",
        value: form.enabledScrapers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    if (form.aiRepairProvider !== initial.aiRepairProvider)
      updates.push({
        key: "workers.aiRepair.provider",
        value: form.aiRepairProvider,
      });
    if (form.aiRepairModel !== initial.aiRepairModel)
      updates.push({
        key: "workers.aiRepair.model",
        value: form.aiRepairModel.trim(),
      });
    if (form.aiRepairOllamaUrl !== initial.aiRepairOllamaUrl)
      updates.push({
        key: "workers.aiRepair.ollamaUrl",
        value: form.aiRepairOllamaUrl.trim(),
      });
    if (form.aiRepairReasoning !== initial.aiRepairReasoning)
      updates.push({
        key: "workers.aiRepair.reasoning",
        value: form.aiRepairReasoning,
      });

    try {
      for (const u of updates) {
        await client.admin.config.update(u);
      }
      toast.success("Settings saved");
      await config.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Instance configuration for search ranking, the worker pipeline, and scraping."
        actions={
          <Button
            onClick={save}
            disabled={!dirty || saving}
            className="min-w-28"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        }
      />

      {config.isLoading || !form ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-muted/30"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Section
            title="Search"
            description="How results are ranked in the search index."
          >
            <Field
              label="Ranking profile"
              hint="Bias results toward overall quality, swarm health, or recency."
            >
              <Select
                value={form.profile}
                onValueChange={(v) => set("profile", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section
            title="Workers"
            description="Concurrency for the background processing pipeline."
          >
            <Field
              label="Ingest concurrency"
              hint="Parallel jobs parsing and indexing new torrents (1–50)."
              htmlFor="ingest"
            >
              <Input
                id="ingest"
                type="number"
                min={1}
                max={50}
                value={form.ingestConcurrency}
                onChange={(e) => set("ingestConcurrency", e.target.value)}
              />
            </Field>
            <Field
              label="Enrichment concurrency"
              hint="Parallel jobs fetching metadata from TMDB/AniList (1–20)."
              htmlFor="enrichment"
            >
              <Input
                id="enrichment"
                type="number"
                min={1}
                max={20}
                value={form.enrichmentConcurrency}
                onChange={(e) => set("enrichmentConcurrency", e.target.value)}
              />
            </Field>
          </Section>

          <Section
            title="Scraping"
            description="Shared settings handed to scrapers at runtime."
          >
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="flaresolverr"
                  className="text-foreground text-sm"
                >
                  FlareSolverr URL
                </Label>
                <p className="text-muted-foreground text-xs">
                  Proxy used to bypass Cloudflare on protected sites.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:w-80">
                <div className="flex gap-2">
                  <Input
                    id="flaresolverr"
                    value={form.flareSolverrUrl}
                    onChange={(e) => set("flareSolverrUrl", e.target.value)}
                    placeholder="http://localhost:8191"
                    disabled={checkMutation.isPending}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => checkMutation.mutate(form.flareSolverrUrl)}
                    disabled={checkMutation.isPending}
                    className="h-10 shrink-0"
                  >
                    {checkMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                </div>
                {checkResult && (
                  <div
                    className={`rounded-md border px-3 py-2.5 text-xs ${
                      checkResult.success
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {checkResult.message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="proxy-url" className="text-foreground text-sm">
                  Proxy URL
                </Label>
                <p className="text-muted-foreground text-xs">
                  Connection string for outbound scraper requests. Ideally a{" "}
                  rotating proxy to avoid IP bans. Leave blank to connect
                  directly.
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:w-80">
                <div className="flex gap-2">
                  <Input
                    id="proxy-url"
                    value={form.proxyUrl}
                    onChange={(e) => set("proxyUrl", e.target.value)}
                    placeholder="http://user:pass@proxy:8080"
                    disabled={proxyCheckMutation.isPending}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => proxyCheckMutation.mutate(form.proxyUrl)}
                    disabled={
                      proxyCheckMutation.isPending || !form.proxyUrl.trim()
                    }
                    className="h-10 shrink-0"
                  >
                    {proxyCheckMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                </div>
                {proxyCheckResult && (
                  <div
                    className={`rounded-md border px-3 py-2.5 text-xs ${
                      proxyCheckResult.success
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {proxyCheckResult.message}
                  </div>
                )}
              </div>
            </div>
            <Field
              label="Enabled scrapers"
              hint="Comma-separated scraper IDs enabled by default."
              htmlFor="enabled-scrapers"
            >
              <Input
                id="enabled-scrapers"
                value={form.enabledScrapers}
                onChange={(e) => set("enabledScrapers", e.target.value)}
                placeholder="1337x, knaben, yts"
                className="font-mono text-sm"
              />
            </Field>
          </Section>

          <Section
            title="AI Repair"
            description="Model used to fix unrecognised or malformed release metadata."
          >
            <Field
              label="Provider"
              hint="OpenRouter for hosted models, Ollama for local inference."
            >
              <Select
                value={form.aiRepairProvider}
                onValueChange={(v) => {
                  const provider = v as AIProvider;
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          aiRepairProvider: provider,
                          aiRepairModel:
                            provider === "openrouter"
                              ? OPENROUTER_MODEL_SUGGESTIONS[0]!
                              : OLLAMA_MODEL_SUGGESTIONS[0]!,
                        }
                      : prev,
                  );
                }}
              >
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ai-model" className="text-foreground text-sm">
                  Model
                </Label>
                <p className="text-muted-foreground text-xs">
                  {form.aiRepairProvider === "openrouter"
                    ? "OpenRouter model ID (e.g. deepseek/deepseek-v4-flash)."
                    : "Local Ollama model tag (e.g. qwen3:8b)."}
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:w-64">
                <Input
                  id="ai-model"
                  value={form.aiRepairModel}
                  onChange={(e) => set("aiRepairModel", e.target.value)}
                  placeholder={
                    form.aiRepairProvider === "openrouter"
                      ? "deepseek/deepseek-v4-flash"
                      : "qwen3:8b"
                  }
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1">
                  {(form.aiRepairProvider === "openrouter"
                    ? OPENROUTER_MODEL_SUGGESTIONS
                    : OLLAMA_MODEL_SUGGESTIONS
                  ).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set("aiRepairModel", m)}
                      className={`rounded px-1.5 py-0.5 font-mono text-xs transition-colors ${
                        form.aiRepairModel === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {form.aiRepairProvider === "ollama" && (
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="ai-ollama-url"
                    className="text-foreground text-sm"
                  >
                    Ollama URL
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Base URL of your Ollama instance.
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:w-80">
                  <div className="flex gap-2">
                    <Input
                      id="ai-ollama-url"
                      value={form.aiRepairOllamaUrl}
                      onChange={(e) => set("aiRepairOllamaUrl", e.target.value)}
                      placeholder="http://ollama:11434"
                      disabled={ollamaCheckMutation.isPending}
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        ollamaCheckMutation.mutate(form.aiRepairOllamaUrl)
                      }
                      disabled={ollamaCheckMutation.isPending}
                      className="h-10 shrink-0"
                    >
                      {ollamaCheckMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                  </div>
                  {ollamaCheckResult && (
                    <div
                      className={`rounded-md border px-3 py-2.5 text-xs ${
                        ollamaCheckResult.success
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                          : "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {ollamaCheckResult.message}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="ai-reasoning"
                  className="text-foreground text-sm"
                >
                  Reasoning
                </Label>
                <p className="text-muted-foreground text-xs">
                  {form.aiRepairProvider === "openrouter"
                    ? "Enable extended reasoning for this model. Increases cost and latency."
                    : "Pass think=true to Ollama (supported by qwen3 and similar models)."}
                </p>
              </div>
              <Switch
                id="ai-reasoning"
                checked={form.aiRepairReasoning}
                onCheckedChange={(v) => set("aiRepairReasoning", v)}
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
