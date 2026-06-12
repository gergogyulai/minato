import { createFileRoute, redirect } from "@tanstack/react-router";
import { Boxes, Database, ShieldCheck } from "lucide-react";

import { GradientText } from "@/components/landing-kit";
import SignInForm from "@/components/sign-in-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (session.data) {
			throw redirect({ to: "/dashboard" });
		}
	},
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
			<div className="relative hidden overflow-hidden border-border/60 border-r bg-card/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
				<div
					aria-hidden
					className="pointer-events-none absolute right-[-80px] top-[-80px] h-[480px] w-[480px] rounded-full [background:radial-gradient(circle,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_65%)]"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(to_right,var(--minato-grid-color)_1px,transparent_1px),linear-gradient(to_bottom,var(--minato-grid-color)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_40%,transparent_100%)]"
				/>

				<div className="relative flex items-baseline gap-2">
					<span className="font-display font-bold text-foreground text-xl tracking-tight">
						Minato
					</span>
					<span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em]">
						admin
					</span>
				</div>

				<div className="relative max-w-md space-y-7">
					<h1
						className="font-display font-bold text-foreground leading-[0.95] tracking-tight"
						style={{ fontSize: "clamp(2.5rem,4vw,3.5rem)" }}
					>
						The control room for your{" "}
						<GradientText>torrent index.</GradientText>
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Monitor ingest pipelines, orchestrate scrapers, and manage access —
						all from one place.
					</p>
					<ul className="space-y-3 border-border/60 border-t pt-6">
						{HIGHLIGHTS.map((h) => (
							<li
								key={h.label}
								className="flex items-center gap-3 font-mono text-muted-foreground text-[13px]"
							>
								<span className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-primary/5">
									<h.icon className="size-3.5 text-primary" />
								</span>
								{h.label}
							</li>
						))}
					</ul>
				</div>

				<div className="relative font-mono text-[11px] text-muted-foreground/40 tracking-wider">
					<span className="text-primary/70">港</span> restricted to
					administrators
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
					<div className="flex items-baseline gap-2 lg:hidden">
						<span className="font-display font-bold text-foreground text-xl tracking-tight">
							Minato
						</span>
						<span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em]">
							admin
						</span>
					</div>

					<div className="space-y-2">
						<p className="select-none font-mono text-[11px] text-muted-foreground/45 uppercase tracking-[0.25em]">
							admin access
						</p>
						<h2 className="font-display font-bold text-3xl text-foreground tracking-tight">
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
