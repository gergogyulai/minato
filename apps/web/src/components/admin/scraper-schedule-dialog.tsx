import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { client } from "@/utils/orpc";

type Scraper = {
	id: string;
	schedule: string | null;
	recommendedSchedule: string | null;
};

const SCHEDULE_PRESETS = [
	{ label: "Hourly",         cron: "0 * * * *",    sub: "Every 60 minutes"  },
	{ label: "Every 4 hours",  cron: "0 */4 * * *",  sub: "6× per day"        },
	{ label: "Every 6 hours",  cron: "0 */6 * * *",  sub: "4× per day"        },
	{ label: "Every 12 hours", cron: "0 */12 * * *", sub: "Twice daily"       },
	{ label: "Daily",          cron: "0 0 * * *",    sub: "Midnight UTC"      },
	{ label: "Weekly",         cron: "0 0 * * 1",    sub: "Monday midnight"   },
] as const;

export function describeCron(expr: string): string {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return "Custom schedule";
	const [min, hour, dom, month, dow] = parts;

	if (min === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*")
		return "Every minute";
	if (min.startsWith("*/") && hour === "*" && dom === "*" && month === "*" && dow === "*") {
		const n = parseInt(min.slice(2), 10);
		return `Every ${n} minute${n !== 1 ? "s" : ""}`;
	}
	if (min === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*")
		return "Every hour";
	if (min === "0" && hour.startsWith("*/") && dom === "*" && month === "*" && dow === "*") {
		const n = parseInt(hour.slice(2), 10);
		return `Every ${n} hours`;
	}
	if (min === "0" && /^\d+$/.test(hour) && dom === "*" && month === "*" && dow === "*") {
		const h = parseInt(hour, 10);
		if (h === 0) return "Daily at midnight UTC";
		if (h === 12) return "Daily at noon UTC";
		const ampm = h < 12 ? "AM" : "PM";
		const h12 = h > 12 ? h - 12 : h;
		return `Daily at ${h12}:00 ${ampm} UTC`;
	}
	if (min === "0" && /^\d+$/.test(hour) && dom === "*" && month === "*" && /^[\d,]+$/.test(dow)) {
		const h = parseInt(hour, 10);
		const ampm = h < 12 ? "AM" : "PM";
		const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const dayList = dow.split(",").map((d) => dayNames[parseInt(d, 10)] ?? d).join(", ");
		return `Every ${dayList} at ${h12}:00 ${ampm} UTC`;
	}
	if (min === "0" && hour === "0" && dom === "1" && month === "*" && dow === "*")
		return "Monthly, 1st at midnight UTC";
	return "Custom schedule";
}

export function ScraperScheduleDialog({
	open,
	onOpenChange,
	scraper,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	scraper: Scraper;
	onSaved: () => void;
}) {
	const [value, setValue] = useState(scraper.schedule ?? "");
	const [advanced, setAdvanced] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (open) {
			const sched = scraper.schedule ?? "";
			setValue(sched);
			setAdvanced(!SCHEDULE_PRESETS.some((p) => p.cron === sched) && sched !== "");
		}
	}, [open, scraper.schedule]);

	const activePreset = SCHEDULE_PRESETS.find((p) => p.cron === value);
	const description = value.trim() ? describeCron(value.trim()) : null;

	async function save() {
		setSaving(true);
		try {
			await client.scraper.updateSchedule({
				id: scraper.id,
				schedule: value.trim() === "" ? null : value.trim(),
			});
			toast.success("Schedule saved");
			onSaved();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Invalid schedule");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Schedule</DialogTitle>
					<DialogDescription>
						Choose when this scraper runs automatically.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 gap-2">
					{SCHEDULE_PRESETS.map((p) => (
						<button
							key={p.cron}
							type="button"
							onClick={() => setValue(p.cron)}
							className={[
								"flex flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								value === p.cron
									? "border-primary bg-primary/10 text-foreground"
									: "border-border bg-transparent text-foreground hover:bg-muted/60",
							].join(" ")}
						>
							<span className="font-medium leading-tight">{p.label}</span>
							<span className="mt-0.5 text-[11px] text-muted-foreground">{p.sub}</span>
						</button>
					))}
				</div>

				{value.trim() && !activePreset && !advanced && (
					<div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
						<span className="font-mono text-xs text-muted-foreground">{value}</span>
						<span className="text-muted-foreground">—</span>
						<span className="text-foreground">{description}</span>
					</div>
				)}

				<button
					type="button"
					onClick={() => setAdvanced((v) => !v)}
					className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronDown
						className={[
							"size-3.5 transition-transform",
							advanced ? "rotate-180" : "",
						].join(" ")}
					/>
					Expert: custom cron expression
				</button>

				{advanced && (
					<div className="space-y-2">
						<Input
							value={value}
							onChange={(e) => setValue(e.target.value)}
							placeholder="0 */6 * * *"
							className="font-mono text-sm"
							autoFocus
						/>
						{value.trim() && (
							<p className="text-xs text-muted-foreground">
								<span className="font-medium text-foreground">{description}</span>
								{" · "}five-field UTC
							</p>
						)}
						{scraper.recommendedSchedule && scraper.recommendedSchedule !== value && (
							<button
								type="button"
								onClick={() => setValue(scraper.recommendedSchedule!)}
								className="text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								Recommended by scraper:{" "}
								<span className="font-mono">{scraper.recommendedSchedule}</span>
							</button>
						)}
					</div>
				)}

				<DialogFooter className="gap-2 sm:gap-2">
					{value.trim() && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setValue("")}
							className="mr-auto text-xs text-muted-foreground"
						>
							Clear schedule
						</Button>
					)}
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={save} disabled={saving} className="min-w-24">
						{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
