"use client";

import { Database, Globe, Layers, Search, Zap } from "lucide-react";
import type { ElementType } from "react";

// Node dimensions — kept as constants so the SVG fork geometry stays in sync
const NW = 180; // node card width (px)
const SINK_GAP = 20; // gap between the two sink nodes (px)
const FW = NW * 2 + SINK_GAP; // total fork row width = 380
const FC = FW / 2; // fork center x = 190
const LC = NW / 2; // left sink center x = 90
const RC = FW - NW / 2; // right sink center x = 290

const NODES = {
	scrapers: { icon: Zap, label: "Scrapers", sub: "bun runtime", color: "#f59e0b" },
	api: { icon: Globe, label: "Hono API", sub: "http / websocket", color: "#60a5fa" },
	workers: { icon: Layers, label: "BullMQ Workers", sub: "concurrent jobs", color: "#f87171" },
	postgres: { icon: Database, label: "Postgres", sub: "persistent store", color: "#22d3ee" },
	meilisearch: { icon: Search, label: "Meilisearch", sub: "search index", color: "#a78bfa" },
} satisfies Record<string, NodeProps>;

interface NodeProps {
	icon: ElementType;
	label: string;
	sub: string;
	color: string;
	width?: number;
}

function PipelineNode({ icon: Icon, label, sub, color, width = NW }: NodeProps) {
	return (
		<div
			className="relative rounded-xl border bg-web-card px-4 py-3.5"
			style={{
				width,
				borderColor: `${color}42`,
				boxShadow: `0 0 36px ${color}12, 0 1px 0 ${color}28 inset`,
			}}
		>
			{/* Vite-style gradient top line */}
			<div
				className="absolute inset-x-4 top-0 h-px rounded-full"
				style={{
					background: `linear-gradient(to right, transparent, ${color}cc, transparent)`,
				}}
			/>
			<div className="flex items-center gap-2.5">
				<div
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
					style={{ backgroundColor: `${color}1c`, color }}
				>
					<Icon size={13} />
				</div>
				<div className="min-w-0">
					<p className="text-xs font-semibold leading-snug text-web-fg">
						{label}
					</p>
					<p className="font-mono text-[10px] tracking-wider text-web-muted/40">
						{sub}
					</p>
				</div>
			</div>
		</div>
	);
}

interface LineProps {
	height?: number;
	color: string;
	delay?: number;
}

function FlowLine({ height = 32, color, delay = 0 }: LineProps) {
	return (
		<svg
			width={2}
			height={height}
			aria-hidden
			style={{ display: "block", overflow: "visible" }}
		>
			<line
				x1="1"
				y1="0"
				x2="1"
				y2={height}
				stroke="var(--web-line)"
				strokeWidth="1.5"
			/>
			<line
				x1="1"
				y1="0"
				x2="1"
				y2={height}
				stroke={color}
				strokeWidth="1.5"
				strokeDasharray="4 5"
				style={{
					animation: `pipeline-flow 1.6s linear infinite ${delay}s`,
				}}
			/>
		</svg>
	);
}

export function PipelineGraph() {
	return (
		<div className="flex flex-col items-center sm:items-start">
			<div className="mb-4 self-start font-mono text-[11px] tracking-[0.2em] text-web-muted/40 uppercase">
				Ingestion pipeline
			</div>

			{/* Mobile: single vertical chain — the 380px fork row doesn't fit */}
			<div className="flex flex-col items-center sm:hidden">
				<PipelineNode {...NODES.scrapers} width={240} />
				<FlowLine color={NODES.scrapers.color} height={26} delay={0} />
				<PipelineNode {...NODES.api} width={240} />
				<FlowLine color={NODES.api.color} height={26} delay={0.3} />
				<PipelineNode {...NODES.workers} width={240} />
				<FlowLine color={NODES.workers.color} height={26} delay={0.6} />
				<PipelineNode {...NODES.postgres} width={240} />
				<FlowLine color={NODES.workers.color} height={26} delay={0.8} />
				<PipelineNode {...NODES.meilisearch} width={240} />
			</div>

			{/* Desktop: fork into the two sinks */}
			<div className="hidden flex-col items-center sm:flex">
				<PipelineNode {...NODES.scrapers} />
				<FlowLine color={NODES.scrapers.color} height={28} delay={0} />
				<PipelineNode {...NODES.api} />
				<FlowLine color={NODES.api.color} height={28} delay={0.3} />
				<PipelineNode {...NODES.workers} />

				{/* Fork connector — SVG with two animated paths */}
				<svg
					width={FW}
					height={44}
					aria-hidden
					style={{ display: "block", overflow: "visible" }}
				>
					{/* Ghost track */}
					<path
						d={`M ${FC} 0 L ${FC} 14 L ${LC} 14 L ${LC} 44`}
						stroke="var(--web-line)"
						strokeWidth="1.5"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d={`M ${FC} 0 L ${FC} 14 L ${RC} 14 L ${RC} 44`}
						stroke="var(--web-line)"
						strokeWidth="1.5"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					{/* Animated flow — left branch */}
					<path
						d={`M ${FC} 0 L ${FC} 14 L ${LC} 14 L ${LC} 44`}
						stroke="#f87171"
						strokeWidth="1.5"
						fill="none"
						strokeDasharray="4 5"
						strokeLinecap="round"
						strokeLinejoin="round"
						style={{ animation: "pipeline-flow 1.6s linear infinite 0.6s" }}
					/>
					{/* Animated flow — right branch */}
					<path
						d={`M ${FC} 0 L ${FC} 14 L ${RC} 14 L ${RC} 44`}
						stroke="#f87171"
						strokeWidth="1.5"
						fill="none"
						strokeDasharray="4 5"
						strokeLinecap="round"
						strokeLinejoin="round"
						style={{ animation: "pipeline-flow 1.6s linear infinite 0.8s" }}
					/>
				</svg>

				{/* Sink nodes */}
				<div style={{ display: "flex", gap: SINK_GAP }}>
					<PipelineNode {...NODES.postgres} />
					<PipelineNode {...NODES.meilisearch} />
				</div>
			</div>
		</div>
	);
}
