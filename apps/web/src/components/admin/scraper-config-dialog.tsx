import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

type Scraper = {
	id: string;
	config: Record<string, unknown>;
};

export function ScraperConfigDialog({
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
	const [value, setValue] = useState(() =>
		JSON.stringify(scraper.config ?? {}, null, 2),
	);
	const [saving, setSaving] = useState(false);

	async function save() {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(value);
		} catch {
			toast.error("Config must be valid JSON");
			return;
		}
		setSaving(true);
		try {
			await client.scraper.updateConfig({ id: scraper.id, config: parsed });
			toast.success("Configuration saved");
			onSaved();
			onOpenChange(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to save config");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Configuration</DialogTitle>
					<DialogDescription>
						Override the scraper's default configuration. Edited as JSON.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					rows={12}
					spellCheck={false}
					className="font-mono text-xs"
				/>
				<DialogFooter className="gap-2 sm:gap-2">
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
