import type { Tone } from "@/components/admin/status-pill";

export type ScraperState =
	| "installing"
	| "ready"
	| "starting"
	| "running"
	| "paused"
	| "scheduled"
	| "stopped"
	| "error"
	| "uninstalling";

export function scraperStateTone(state: string): Tone {
	switch (state) {
		case "running":
			return "success";
		case "ready":
		case "scheduled":
			return "info";
		case "paused":
		case "starting":
		case "installing":
		case "uninstalling":
			return "warning";
		case "error":
			return "danger";
		default:
			return "neutral";
	}
}

export function scraperStateLabel(state: string): string {
	return state.charAt(0).toUpperCase() + state.slice(1);
}
