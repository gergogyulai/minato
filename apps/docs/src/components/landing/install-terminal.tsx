"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const COMMANDS = [
	"curl -O https://minato.run",
	"docker compose up -d",
];

export function InstallTerminal() {
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(COMMANDS.join("\n"));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-web-line-strong bg-web-card/70 backdrop-blur-sm dark:border-white/10 dark:bg-black/40">
			<div className="flex items-center justify-between border-b border-web-line px-4 py-2">
				<span className="font-mono text-[11px] tracking-wider text-web-muted/50">
					~/minato
				</span>
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-web-muted/50 transition-colors hover:bg-web-fg/5 hover:text-web-fg"
					aria-label="Copy install commands"
				>
					<AnimatePresence mode="wait" initial={false}>
						<motion.span
							key={copied ? "check" : "copy"}
							className="inline-flex items-center gap-1.5"
							initial={{ scale: 0.6, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.6, opacity: 0 }}
							transition={{ type: "spring", stiffness: 500, damping: 30 }}
						>
							{copied ? (
								<Check size={12} className="text-emerald-600 dark:text-emerald-400" />
							) : (
								<Copy size={12} />
							)}
							{copied ? "copied" : "copy"}
						</motion.span>
					</AnimatePresence>
				</button>
			</div>
			<pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-7">
				{COMMANDS.map((cmd) => (
					<code key={cmd} className="block whitespace-pre text-web-muted">
						<span className="select-none text-web-primary">$ </span>
						{cmd}
					</code>
				))}
			</pre>
		</div>
	);
}
