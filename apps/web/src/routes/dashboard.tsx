import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AdminMobileBar, AdminSidebar } from "@/components/admin/admin-sidebar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
	component: DashboardLayout,
	beforeLoad: async () => {
		const session = await authClient.getSession();

		if (!session.data) {
			throw redirect({ to: "/login" });
		}

		const role = (session.data.user as { role?: string }).role;
		if (role !== "admin") {
			// Authenticated but not an admin — bounce to the public app.
			throw redirect({ to: "/" });
		}

		return { session };
	},
});

function DashboardLayout() {
	return (
		<div className="relative min-h-screen bg-background">
			{/* Ambient backdrop — signature dot-grid under a soft primary glow. */}
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 -z-10 opacity-60 [background:radial-gradient(60rem_40rem_at_-10%_-10%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]"
			/>
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 -z-10 [background-image:radial-gradient(circle,var(--minato-grid-color)_1px,transparent_1px)] [background-size:28px_28px]"
			/>
			<AdminSidebar />
			<AdminMobileBar />
			<main className="md:pl-60">
				<div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
