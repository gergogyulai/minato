import { Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Boxes,
	KeyRound,
	LayoutDashboard,
	LogOut,
	Menu,
	Settings,
	SlidersHorizontal,
	Users,
} from "lucide-react";
import { useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type NavItem = {
	to: string;
	label: string;
	icon: LucideIcon;
	exact?: boolean;
};

const NAV: NavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
	{ to: "/dashboard/scrapers", label: "Scrapers", icon: Boxes },
	{ to: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
	{ to: "/dashboard/users", label: "Users", icon: Users },
	{ to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function Wordmark() {
	return (
		<Link to="/dashboard" className="flex items-center gap-2.5">
			<span className="flex size-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30 ring-inset">
				<SlidersHorizontal className="size-3.5 text-primary" />
			</span>
			<span className="flex items-baseline gap-1.5">
				<span className="font-semibold text-base text-foreground tracking-tight">
					Minato
				</span>
				<span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
					Admin
				</span>
			</span>
		</Link>
	);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<nav className="flex flex-col gap-0.5">
			{NAV.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					activeOptions={{ exact: item.exact ?? false }}
					onClick={onNavigate}
					className="group/nav flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
					activeProps={{
						className: "bg-accent text-foreground [&_svg]:text-primary",
					}}
				>
					<item.icon className="size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover/nav:text-foreground" />
					{item.label}
				</Link>
			))}
		</nav>
	);
}

function Footer() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();

	return (
		<div className="mt-auto space-y-3 border-border border-t pt-4">
			<div className="flex items-center justify-between gap-2 px-1">
				<div className="min-w-0">
					<p className="truncate font-medium text-foreground text-sm">
						{session?.user.name ?? "Administrator"}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						{session?.user.email ?? ""}
					</p>
				</div>
				<ModeToggle />
			</div>
			<Button
				variant="ghost"
				size="sm"
				className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
				onClick={() =>
					authClient.signOut({
						fetchOptions: {
							onSuccess: () => navigate({ to: "/login" }),
						},
					})
				}
			>
				<LogOut className="size-4" />
				Sign out
			</Button>
		</div>
	);
}

export function AdminSidebar() {
	return (
		<aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-6 border-border border-r bg-sidebar px-4 py-6 md:flex">
			<div className="px-1">
				<Wordmark />
			</div>
			<NavLinks />
			<Footer />
		</aside>
	);
}

export function AdminMobileBar() {
	const [open, setOpen] = useState(false);

	return (
		<header className="sticky top-0 z-40 flex items-center justify-between border-border border-b bg-background/80 px-4 py-3 backdrop-blur-md md:hidden">
			<Wordmark />
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button variant="outline" size="icon">
						<Menu className="size-4" />
						<span className="sr-only">Open navigation</span>
					</Button>
				</SheetTrigger>
				<SheetContent
					side="left"
					className="flex w-64 flex-col gap-6 bg-sidebar px-4 py-6"
				>
					<div className="px-1">
						<Wordmark />
					</div>
					<NavLinks onNavigate={() => setOpen(false)} />
					<Footer />
				</SheetContent>
			</Sheet>
		</header>
	);
}
