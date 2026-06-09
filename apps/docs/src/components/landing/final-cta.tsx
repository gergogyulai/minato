import Link from "next/link";
import { Reveal, SectionRule } from "./motion";

const FOOTER_LINKS = [
  { label: "Documentation", href: "/docs" },
  { label: "Roadmap", href: "/roadmap" },
  {
    label: "GitHub",
    href: "https://github.com/gergogyulai/minato",
    external: true,
  },
  {
    label: "License (MIT)",
    href: "https://github.com/gergogyulai/minato/blob/main/LICENSE",
    external: true,
  },
];

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-web-line py-24 md:py-32">
      {/* Background glow — voidzero style */}
      <div
        className="pointer-events-none absolute left-[-200px] top-[-100px] h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.424 0.199 265.638 / 0.12) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <SectionRule label="06 / Start" />

        {/* Split — large heading left, body right */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[3fr_2fr] md:gap-16">
          <Reveal>
            <h2
              className="font-display font-bold leading-none tracking-tight"
              style={{ fontSize: "clamp(3rem, 6.5vw, 5.5rem)" }}
            >
              <span className="block text-web-fg">Own your</span>
              <span className="heading-gradient block">index.</span>
            </h2>
          </Reveal>

          <Reveal className="flex flex-col justify-center gap-8" delay={0.12}>
            <p className="text-base leading-relaxed text-web-muted">
              Public indexers disappear. Minato doesn't. Spin it up in under a
              minute and stop depending on infrastructure you don't control.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex h-10 items-center rounded-md bg-web-fg px-5 text-sm font-medium text-web-bg transition-[background-color,transform] duration-200 hover:bg-web-fg/90 active:scale-[0.97]"
              >
                Read the Docs
              </Link>
              <a
                href="https://github.com/gergogyulai/minato"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 gap-2 items-center rounded-md border border-web-line-strong px-5 text-sm font-medium text-web-muted transition-[border-color,color,transform] duration-200 hover:border-web-muted/40 hover:text-web-fg active:scale-[0.97]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 007.86 10.93c.58.1.79-.25.79-.56v-2c-3.2.69-3.88-1.37-3.88-1.37-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.68 1.25 3.33.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.67 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.18a10.96 10.96 0 015.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.57.23 2.73.11 3.02.74.8 1.18 1.83 1.18 3.08 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </Reveal>
        </div>

        {/* Footer links */}
        <div className="mt-20 flex flex-wrap items-center justify-between gap-6 border-t border-web-line pt-8">
          <p className="font-mono text-[11px] tracking-wider text-web-muted/35">
            <span className="text-web-primary/70">港</span> minato — built in
            the open, one harbor at a time
          </p>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {FOOTER_LINKS.map((link, i) => (
              <span key={link.label} className="flex items-center">
                {link.external ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 text-sm text-web-muted/35 transition-colors hover:text-web-muted"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className="px-3 text-sm text-web-muted/35 transition-colors hover:text-web-muted"
                  >
                    {link.label}
                  </Link>
                )}
                {i < FOOTER_LINKS.length - 1 && (
                  <span className="text-web-muted/15">·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
