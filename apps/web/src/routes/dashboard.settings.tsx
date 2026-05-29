import { useQuery } from "@tanstack/react-query";
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
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/settings")({
	component: SettingsPage,
});

const PROFILES = ["quality", "health", "freshness"] as const;

type FormState = {
	profile: string;
	ingestConcurrency: string;
	enrichmentConcurrency: string;
	flareSolverrUrl: string;
	enabledScrapers: string;
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

	useEffect(() => {
		if (!config.data) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const c = config.data.config as any;
		const next: FormState = {
			profile: c.search?.profile ?? "health",
			ingestConcurrency: String(c.workers?.ingest?.concurrency ?? 5),
			enrichmentConcurrency: String(c.workers?.enrichment?.concurrency ?? 5),
			flareSolverrUrl: c.scraper?.flareSolverrUrl ?? "",
			enabledScrapers: (c.scraper?.enabledScrapers ?? []).join(", "),
		};
		setForm(next);
		setInitial(next);
	}, [config.data]);

	const dirty =
		form && initial && JSON.stringify(form) !== JSON.stringify(initial);

	function set<K extends keyof FormState>(key: K, value: string) {
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
		if (form.enabledScrapers !== initial.enabledScrapers)
			updates.push({
				key: "scraper.enabledScrapers",
				value: form.enabledScrapers
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
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
						<Field
							label="FlareSolverr URL"
							hint="Proxy used to bypass Cloudflare on protected sites."
							htmlFor="flaresolverr"
						>
							<Input
								id="flaresolverr"
								value={form.flareSolverrUrl}
								onChange={(e) => set("flareSolverrUrl", e.target.value)}
								placeholder="http://localhost:8191"
								className="font-mono text-sm"
							/>
						</Field>
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
				</div>
			)}
		</div>
	);
}
