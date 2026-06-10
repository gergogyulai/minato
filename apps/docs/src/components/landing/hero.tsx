import Link from "next/link";
import { HeroDither } from "./hero-dither";
import { InstallTerminal } from "./install-terminal";

const STATS = [
  { value: "MIT", label: "license" },
  { value: "< 300ms*", label: "cold start" },
  { value: "single container", label: "docker" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-6 pt-20 pb-16 md:pt-24">
      <HeroDither />
      <div
        className="pointer-events-none absolute right-[-80px] top-[-80px] h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.424 0.199 265.638 / 0.18) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px-9rem)] max-w-5xl flex-col justify-between gap-14 pt-8">
        <div>
          <h1
            className="anim-enter mb-8 font-display font-bold leading-[0.94] tracking-tight"
            style={
              {
                fontSize: "clamp(3.25rem, 9vw, 7rem)",
                "--enter-delay": "0.08s",
              } as React.CSSProperties
            }
          >
            <span className="block text-web-fg">Your index,</span>
            <span className="heading-gradient block">permanently.</span>
          </h1>

          <div className="grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
            <div
              className="anim-enter"
              style={{ "--enter-delay": "0.16s" } as React.CSSProperties}
            >
              <p className="mb-7 text-base leading-relaxed text-web-muted">
                Project Minato is a self-hosted vault platform
                for the torrent ecosystem. It captures infohashes, and
                metadata from trackers and keeps them locally,
                forever.
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
            </div>

            <div
              className="anim-enter"
              style={{ "--enter-delay": "0.24s" } as React.CSSProperties}
            >
              <InstallTerminal />
              <p className="mt-3 text-xs text-web-muted/60">
                Environment variables must be configured before running —
                see the{" "}
                <Link
                  href="/docs/deployment"
                  className="underline underline-offset-2 transition-colors hover:text-web-fg"
                >
                  docs
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Stat hairline */}
        <div
          className="anim-enter flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-web-line pt-6"
          style={{ "--enter-delay": "0.34s" } as React.CSSProperties}
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2.5">
              <span className="font-mono text-sm font-medium text-web-fg">
                {stat.value}
              </span>
              <span className="font-mono text-[11px] tracking-wider text-web-muted/40">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
