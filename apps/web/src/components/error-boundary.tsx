import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { type FallbackProps, ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

import { Button } from "@/components/ui/button";

function toMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "An unexpected error occurred.";
}

function ErrorDisplay({
	message,
	onReset,
}: {
	message: string;
	onReset?: () => void;
}) {
	return (
		<div className="flex min-h-[40vh] flex-col items-center justify-center gap-5 px-4 text-center">
			<div className="flex size-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
				<AlertTriangle className="size-6 text-destructive" />
			</div>
			<div className="space-y-1.5">
				<h2 className="font-semibold text-foreground text-lg">
					Something went wrong
				</h2>
				<p className="max-w-sm text-muted-foreground text-sm">
					{message || "An unexpected error occurred."}
				</p>
			</div>
			{onReset && (
				<Button variant="outline" onClick={onReset} className="gap-2">
					<RefreshCw className="size-4" />
					Try again
				</Button>
			)}
		</div>
	);
}

export function RouteErrorBoundary({ error }: { error: unknown }) {
	const router = useRouter();
	return (
		<ErrorDisplay
			message={toMessage(error)}
			onReset={() => router.invalidate()}
		/>
	);
}

export function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<ErrorDisplay message={toMessage(error)} onReset={resetErrorBoundary} />
		</div>
	);
}

export { ReactErrorBoundary as ErrorBoundary };
