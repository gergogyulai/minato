import { Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function DashboardHeader() {
	return (
		<header className="fixed top-0 right-0 left-0 z-50 border-border border-b bg-background/80 backdrop-blur-md">
			<div className="flex flex-row items-center justify-between px-6 py-3">
				<div className="flex items-center gap-3">
					<LayoutDashboard className="size-5 text-primary" />
					<Link
						to="/dashboard"
						className="font-semibold text-lg tracking-tight transition-opacity hover:opacity-80"
					>
						Dashboard
					</Link>
					<span className="text-border">|</span>
					<Link
						to="/"
						className="text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						Browse Torrents
					</Link>
				</div>
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
