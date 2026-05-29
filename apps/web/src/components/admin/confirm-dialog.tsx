import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	loading = false,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	loading?: boolean;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && (
						<DialogDescription className="leading-relaxed">
							{description}
						</DialogDescription>
					)}
				</DialogHeader>
				<DialogFooter className="gap-2 sm:gap-2">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						{cancelLabel}
					</Button>
					<Button
						variant={destructive ? "destructive" : "default"}
						onClick={onConfirm}
						disabled={loading}
						className="min-w-24"
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							confirmLabel
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
