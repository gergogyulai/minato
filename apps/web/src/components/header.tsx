import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-md border-b border-border/40">
      <div className="flex flex-row items-center justify-between px-6 py-3">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link 
                key={to} 
                to={to}
                className="hover:opacity-80 transition-opacity"
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
