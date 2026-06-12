import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/queues")({
	component: QueuesPage,
});

type QueueKey = "ingest" | "enrich" | "housekeeper" | "ai_repair";
type StatusKey = "waiting" | "failed" | "active" | "delayed";

type QueueCounts = Record<StatusKey, number>;

const QUEUES: { key: QueueKey; label: string }[] = [
	{ key: "ingest", label: "Ingest" },
	{ key: "enrich", label: "Enrich" },
	{ key: "housekeeper", label: "Housekeeper" },
	{ key: "ai_repair", label: "AI Repair" },
];

const STATUSES: { key: StatusKey; label: string }[] = [
	{ key: "waiting", label: "Waiting" },
	{ key: "failed", label: "Failed" },
	{ key: "active", label: "Active" },
	{ key: "delayed", label: "Delayed" },
];

const PAGE_SIZE = 100;

const fmt = new Intl.NumberFormat();
const fmtTime = (ts: number | null) =>
	ts ? new Date(ts).toLocaleString() : "—";

function truncateJson(data: unknown, max = 80) {
	const s = JSON.stringify(data);
	return s.length > max ? `${s.slice(0, max)}…` : s;
}

type Job = {
	id: string;
	name: string;
	data: unknown;
	failedReason: string | null;
	stacktrace: string[] | null;
	timestamp: number;
	processedOn: number | null;
	finishedOn: number | null;
	attemptsMade: number;
};

function JobDetailDialog({
	job,
	onClose,
}: {
	job: Job | null;
	onClose: () => void;
}) {
	const isFailed = !!job?.failedReason;

	return (
		<Dialog open={job !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="border-border border-b px-6 py-4">
					<DialogTitle>{job?.name ?? ""}</DialogTitle>
					<p className="font-mono text-muted-foreground text-xs">{job?.id}</p>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
					{/* Timestamps */}
					<dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
						<div>
							<dt className="text-muted-foreground text-xs">Added</dt>
							<dd className="text-foreground">{fmtTime(job?.timestamp ?? null)}</dd>
						</div>
						{job?.processedOn && (
							<div>
								<dt className="text-muted-foreground text-xs">Processed</dt>
								<dd className="text-foreground">{fmtTime(job.processedOn)}</dd>
							</div>
						)}
						{job?.finishedOn && (
							<div>
								<dt className="text-muted-foreground text-xs">{isFailed ? "Failed at" : "Finished"}</dt>
								<dd className="text-foreground">{fmtTime(job.finishedOn)}</dd>
							</div>
						)}
						<div>
							<dt className="text-muted-foreground text-xs">Attempts</dt>
							<dd className="text-foreground tabular-nums">{job?.attemptsMade ?? 0}</dd>
						</div>
					</dl>

					{/* Failure reason */}
					{isFailed && (
						<div className="space-y-1.5">
							<p className="font-medium text-red-600 text-xs uppercase tracking-wide dark:text-red-400">
								Failure reason
							</p>
							<p className="rounded-lg bg-red-500/8 px-3 py-2 text-red-700 text-sm dark:text-red-300">
								{job?.failedReason}
							</p>
						</div>
					)}

					{/* Stack trace */}
					{job?.stacktrace && job.stacktrace.length > 0 && (
						<div className="space-y-1.5">
							<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Stack trace
							</p>
							<pre className="overflow-x-auto rounded-lg bg-muted/50 px-3 py-2.5 font-mono text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
								{job.stacktrace.join("\n\n")}
							</pre>
						</div>
					)}

					{/* Payload */}
					<div className="space-y-1.5">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Payload
						</p>
						<pre className="overflow-x-auto rounded-lg bg-muted/50 px-3 py-2.5 font-mono text-foreground text-xs leading-relaxed">
							{JSON.stringify(job?.data, null, 2)}
						</pre>
					</div>
				</div>

				<DialogFooter className="border-border border-t px-6 py-4" showCloseButton />
			</DialogContent>
		</Dialog>
	);
}

function JobTable({
	queue,
	status,
	totalCount,
}: {
	queue: QueueKey;
	status: StatusKey;
	totalCount: number;
}) {
	const [page, setPage] = useState(1);
	const [selectedJob, setSelectedJob] = useState<Job | null>(null);
	const isFailed = status === "failed";
	const maxItems = isFailed ? 500 : 100;
	const cappedTotal = Math.min(totalCount, maxItems);
	const totalPages = Math.max(1, Math.ceil(cappedTotal / PAGE_SIZE));
	const start = (page - 1) * PAGE_SIZE;
	const end = Math.min(page * PAGE_SIZE - 1, maxItems - 1);

	useEffect(() => {
		if (page > totalPages) setPage(1);
	}, [page, totalPages]);

	const { data, isLoading, isError } = useQuery({
		...orpc.queues.jobs.queryOptions({
			input: { queue, status, start, end },
		}),
		refetchInterval: 5_000,
	});

	if (isLoading) {
		return (
			<div className="space-y-2 pt-2">
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="pt-4 text-center text-muted-foreground text-sm">
				Failed to load jobs. Is Redis reachable?
			</p>
		);
	}

	const jobs = data?.jobs ?? [];

	if (jobs.length === 0) {
		return (
			<div className="pt-4">
				<EmptyState
					icon={Inbox}
					title={`No ${status} jobs`}
					description={`The ${queue} queue has no ${status} jobs right now.`}
				/>
			</div>
		);
	}

	return (
		<>
			<JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />

			<div className="mt-2 overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-border border-b bg-muted/30 text-left text-muted-foreground text-xs">
							<th className="px-3 py-2.5 font-medium">Job ID</th>
							<th className="px-3 py-2.5 font-medium">Name</th>
							{isFailed ? (
								<>
									<th className="px-3 py-2.5 font-medium">Failure reason</th>
									<th className="px-3 py-2.5 font-medium">Attempts</th>
									<th className="px-3 py-2.5 font-medium">Failed at</th>
								</>
							) : (
								<>
									<th className="px-3 py-2.5 font-medium">Data</th>
									<th className="px-3 py-2.5 font-medium">Added</th>
								</>
							)}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{jobs.map((job) => (
							<tr
								key={job.id}
								className="cursor-pointer transition-colors hover:bg-muted/20"
								onClick={() => setSelectedJob(job)}
							>
								<td className="px-3 py-2.5 font-mono text-muted-foreground text-xs">
									{job.id.slice(0, 12)}…
								</td>
								<td className="px-3 py-2.5 text-foreground">{job.name}</td>
								{isFailed ? (
									<>
										<td className="max-w-xs px-3 py-2.5">
											<span className="block truncate text-red-600 text-xs dark:text-red-400">
												{job.failedReason ?? "—"}
											</span>
										</td>
										<td className="px-3 py-2.5 tabular-nums text-muted-foreground text-xs">
											{job.attemptsMade}
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground text-xs">
											{fmtTime(job.finishedOn ?? job.processedOn)}
										</td>
									</>
								) : (
									<>
										<td className="max-w-xs px-3 py-2.5">
											<span className="block truncate font-mono text-muted-foreground text-xs">
												{truncateJson(job.data)}
											</span>
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground text-xs">
											{fmtTime(job.timestamp)}
										</td>
									</>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="mt-4 space-y-2">
					<p className="text-center text-muted-foreground text-xs">
						Page {page} of {totalPages} ·{" "}
						<span className="text-foreground tabular-nums">
							{fmt.format(cappedTotal)}
						</span>{" "}
						jobs
					</p>
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									onClick={(e) => {
										e.preventDefault();
										setPage((p) => Math.max(1, p - 1));
									}}
									className={
										page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
									}
								/>
							</PaginationItem>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
								<PaginationItem key={p}>
									<PaginationLink
										isActive={p === page}
										onClick={(e) => {
											e.preventDefault();
											setPage(p);
										}}
										className="cursor-pointer"
									>
										{p}
									</PaginationLink>
								</PaginationItem>
							))}
							<PaginationItem>
								<PaginationNext
									onClick={(e) => {
										e.preventDefault();
										setPage((p) => Math.min(totalPages, p + 1));
									}}
									className={
										page === totalPages
											? "pointer-events-none opacity-50"
											: "cursor-pointer"
									}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			)}
		</>
	);
}

function QueuePanel({
	queue,
	counts,
}: {
	queue: QueueKey;
	counts: QueueCounts | undefined;
}) {
	const [status, setStatus] = useState<StatusKey>("waiting");

	return (
		<Tabs value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
			<TabsList className="h-8">
				{STATUSES.map((s) => (
					<TabsTrigger key={s.key} value={s.key} className="text-xs">
						{s.label}
					</TabsTrigger>
				))}
			</TabsList>
			{STATUSES.map((s) => (
				<TabsContent key={s.key} value={s.key}>
					<JobTable
						queue={queue}
						status={s.key}
						totalCount={counts?.[s.key] ?? 0}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}

function QueuesPage() {
	const [activeQueue, setActiveQueue] = useState<QueueKey>("ingest");

	const { data: statusData } = useQuery({
		...orpc.queues.status.queryOptions(),
		refetchInterval: 2_000,
	});

	const countsMap = Object.fromEntries(
		(statusData?.queues ?? []).map((q) => [
			q.name,
			{
				waiting: q.waiting,
				active: q.active,
				failed: q.failed,
				delayed: q.delayed,
			} satisfies QueueCounts,
		]),
	) as Partial<Record<QueueKey, QueueCounts>>;

	return (
		<div>
			<PageHeader
				eyebrow="dashboard // queues"
				title="Queues"
				description="Inspect waiting, active, delayed, and failed jobs in each BullMQ queue."
			/>

			<Tabs
				value={activeQueue}
				onValueChange={(v) => setActiveQueue(v as QueueKey)}
			>
				<TabsList className="mb-6 h-9">
					{QUEUES.map((q) => {
						const failed = countsMap[q.key]?.failed ?? 0;
						return (
							<TabsTrigger key={q.key} value={q.key} className="gap-2">
								{q.label}
								{failed > 0 && (
									<StatusPill
										tone="danger"
										className="h-4 rounded px-1 py-0 text-[10px]"
									>
										{fmt.format(failed)}
									</StatusPill>
								)}
							</TabsTrigger>
						);
					})}
				</TabsList>

				{QUEUES.map((q) => (
					<TabsContent key={q.key} value={q.key}>
						<QueuePanel queue={q.key} counts={countsMap[q.key]} />
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
