import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
	return {
		githubUrl: "https://github.com/gergogyulai/minato",
		nav: {
			title: (
				<span className="inline-flex items-baseline gap-1.5 font-semibold tracking-tight">
					<span aria-hidden className="text-web-primary">
						港
					</span>
					Project Minato
				</span>
			),
		},
	};
}
