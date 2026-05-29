import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function TorrentHeader() {
	return (
		<header className="fixed top-0 right-0 left-0 z-50 border-border/40 border-b bg-transparent backdrop-blur-md">
			<div className="flex flex-row items-center justify-end px-6 py-3">
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
