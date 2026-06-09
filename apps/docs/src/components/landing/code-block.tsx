"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface CodeBlockProps {
	code: string;
	language: "bash" | "typescript";
	filename?: string;
}

function escape(str: string) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

// Single pass: comments | strings | keywords | built-ins. One combined regex
// so a replacement can never re-tokenise HTML injected by an earlier pass
// (e.g. the keyword `var` matching inside style="color:var(...)").
const TS_TOKEN =
	/(\/\/[^\n]*)|("[^"\n]*?"|'[^'\n]*?'|`[^`]*?`)|\b(const|let|var|export|default|import|from|function|async|await|return|type|interface|class|extends|implements|new|this|typeof|keyof|as|in|of|for|if|else|throw|try|catch|void)\b|\b(console|fetch|Promise|Array|Object|Error|JSON|Math|Date|Map|Set|undefined|null|true|false)\b/g;

function tokeniseTs(raw: string): string {
	return escape(raw).replace(TS_TOKEN, (match, comment, str, keyword) => {
		const color = comment
			? "--code-comment"
			: str
				? "--code-string"
				: keyword
					? "--code-keyword"
					: "--code-builtin";
		return `<span style="color:var(${color})">${match}</span>`;
	});
}

function tokeniseBash(raw: string): string {
	const s = escape(raw);
	return s.replace(/^(\$)\s/gm, `<span style="color:var(--code-comment)">$1</span> `);
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	const highlighted =
		language === "typescript" ? tokeniseTs(code) : tokeniseBash(code);

	return (
		<div className="relative overflow-hidden rounded-lg border border-web-line bg-web-card dark:bg-web-bg">
			{filename && (
				<div className="flex items-center gap-2 border-b border-web-line bg-web-elevated/60 px-4 py-2">
					<span className="font-mono text-xs text-web-muted">
						{filename}
					</span>
				</div>
			)}
			<button
				type="button"
				onClick={handleCopy}
				className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-web-muted/40 transition-colors hover:bg-web-fg/5 hover:text-web-muted"
				aria-label="Copy code"
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={copied ? "check" : "copy"}
						className="block"
						initial={{ scale: 0.6, opacity: 0, rotate: -45 }}
						animate={{ scale: 1, opacity: 1, rotate: 0 }}
						exit={{ scale: 0.6, opacity: 0, rotate: 45 }}
						transition={{ type: "spring", stiffness: 500, damping: 30 }}
					>
						{copied ? (
							<Check size={14} className="text-emerald-600 dark:text-emerald-400" />
						) : (
							<Copy size={14} />
						)}
					</motion.span>
				</AnimatePresence>
			</button>
			<pre className="overflow-x-auto p-4 pr-10 text-sm leading-relaxed text-web-muted">
				<code
					className="font-mono"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: controlled static copy, not user input
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			</pre>
		</div>
	);
}
