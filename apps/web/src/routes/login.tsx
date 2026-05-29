import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Database, ShieldCheck, SlidersHorizontal } from "lucide-react";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

const HIGHLIGHTS = [
	{ icon: Database, label: "Unified torrent index" },
	{ icon: Boxes, label: "Pluggable scrapers" },
	{ icon: ShieldCheck, label: "Torznab-ready API" },
];

function LoginPage() {
	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			{/* Brand panel */}
			<div className="relative hidden overflow-hidden border-border border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(40rem_30rem_at_20%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)]"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:38px_38px]"
				/>

				<div className="relative flex items-center gap-2.5">
					<span className="flex size-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30 ring-inset">
						<SlidersHorizontal className="size-4 text-primary" />
					</span>
					<span className="flex items-baseline gap-1.5">
						<span className="font-semibold text-foreground text-lg tracking-tight">
							Minato
						</span>
						<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
							Admin
						</span>
					</span>
				</div>

				<div className="relative max-w-md space-y-6">
					<h1 className="font-semibold text-3xl text-foreground leading-tight tracking-tight">
						The control room for your{" "}
						<span className="text-primary">torrent index</span>.
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Monitor ingest pipelines, orchestrate scrapers, and manage access —
						all from one place.
					</p>
					<ul className="space-y-3">
						{HIGHLIGHTS.map((h) => (
							<li
								key={h.label}
								className="flex items-center gap-3 text-muted-foreground text-sm"
							>
								<span className="flex size-7 items-center justify-center rounded-md border border-border bg-background/40">
									<h.icon className="size-3.5 text-primary" />
								</span>
								{h.label}
							</li>
						))}
					</ul>
				</div>

				<div className="relative text-muted-foreground text-xs">
					Restricted to administrators.
				</div>
			</div>

			{/* Form panel */}
			<div className="relative flex items-center justify-center bg-background px-6 py-12">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(40rem_30rem_at_80%_120%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)] lg:hidden"
				/>
				<div className="relative w-full max-w-sm space-y-8">
					{/* Mobile wordmark */}
					<div className="flex items-center gap-2.5 lg:hidden">
						<span className="flex size-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30 ring-inset">
							<SlidersHorizontal className="size-4 text-primary" />
						</span>
						<span className="font-semibold text-foreground text-lg tracking-tight">
							Minato
						</span>
					</div>

					<div className="space-y-1.5">
						<h2 className="font-semibold text-2xl text-foreground tracking-tight">
							Sign in
						</h2>
						<p className="text-muted-foreground text-sm">
							Enter your administrator credentials to continue.
						</p>
					</div>

					<SignInForm />
				</div>
			</div>
		</div>
	);
}
