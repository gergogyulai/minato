import { CommandMenuShell } from "./command-menu"
import { rootPage } from "./pages"

/** App-wide command menu, toggled with ⌘K / ctrl+K. */
export function CommandMenu() {
	return <CommandMenuShell rootPage={rootPage} />
}

export {
	CommandMenuItem,
	CommandMenuShell,
	IconTile,
	Kbd,
	openCommandMenu,
	SectionLabel,
	useCommandMenu,
} from "./command-menu"
export type { CommandMenuController, CommandMenuPage } from "./command-menu"
