import type { ReleaseData } from "@project-minato/db";
import type { CSSProperties, ReactNode } from "react";

const base: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "0.45rem",
	padding: "0.35rem 0.75rem 0.35rem 0.6rem",
	borderRadius: "6px",
	fontSize: "0.82rem",
	fontWeight: 700,
	letterSpacing: "0.04em",
	textTransform: "uppercase",
	cursor: "default",
	transition: "filter 0.15s, transform 0.15s",
	whiteSpace: "nowrap",
	fontFamily: "'Rajdhani', sans-serif",
};

const S: Record<string, CSSProperties> = {
	atmos: {
		...base,
		background: "linear-gradient(135deg, #1a0533 0%, #2d0a55 100%)",
		color: "#c084fc",
		border: "1px solid #7c3aed55",
		boxShadow: "0 0 12px #7c3aed22, inset 0 1px 0 #ffffff0f",
	},
	truehd: {
		...base,
		background: "linear-gradient(135deg, #1a0005 0%, #2e000d 100%)",
		color: "#f472b6",
		border: "1px solid #be185d55",
		boxShadow: "0 0 12px #be185d22, inset 0 1px 0 #ffffff0f",
	},
	dts: {
		...base,
		background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
		color: "#818cf8",
		border: "1px solid #4f46e555",
		boxShadow: "0 0 12px #4f46e522, inset 0 1px 0 #ffffff0f",
	},
	eac3: {
		...base,
		background: "linear-gradient(135deg, #1a0010 0%, #280018 100%)",
		color: "#e879f9",
		border: "1px solid #a21caf55",
		boxShadow: "0 0 12px #a21caf22, inset 0 1px 0 #ffffff0f",
	},
	flac: {
		...base,
		background: "linear-gradient(135deg, #001515 0%, #002020 100%)",
		color: "#5eead4",
		border: "1px solid #0f766e55",
		boxShadow: "0 0 12px #0f766e22, inset 0 1px 0 #ffffff0f",
	},
	dovi: {
		...base,
		background: "linear-gradient(135deg, #001a2e 0%, #002d4a 100%)",
		color: "#38bdf8",
		border: "1px solid #0284c755",
		boxShadow: "0 0 12px #0284c722, inset 0 1px 0 #ffffff0f",
	},
	hdr: {
		...base,
		background: "linear-gradient(135deg, #1a0f00 0%, #2d1900 100%)",
		color: "#fb923c",
		border: "1px solid #c2410c55",
		boxShadow: "0 0 12px #c2410c22, inset 0 1px 0 #ffffff0f",
	},
	hdr10plus: {
		...base,
		background: "linear-gradient(135deg, #1a0f00 0%, #291400 100%)",
		color: "#fbbf24",
		border: "1px solid #d97706aa",
		boxShadow: "0 0 14px #d9770633, inset 0 1px 0 #ffffff0f",
	},
	hlg: {
		...base,
		background: "linear-gradient(135deg, #001a0f 0%, #00291a 100%)",
		color: "#34d399",
		border: "1px solid #05966955",
		boxShadow: "0 0 12px #05966922, inset 0 1px 0 #ffffff0f",
	},
	sdr: {
		...base,
		background: "linear-gradient(135deg, #111 0%, #1c1c1c 100%)",
		color: "#94a3b8",
		border: "1px solid #33333366",
		boxShadow: "inset 0 1px 0 #ffffff0a",
	},
	"4k": {
		...base,
		background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
		color: "#e2e8f0",
		border: "1px solid #ffffff33",
		boxShadow: "0 0 12px #ffffff11, inset 0 1px 0 #ffffff15",
	},
	bluray: {
		...base,
		background: "linear-gradient(135deg, #00102a 0%, #001a40 100%)",
		color: "#60a5fa",
		border: "1px solid #2563eb55",
		boxShadow: "0 0 12px #2563eb22, inset 0 1px 0 #ffffff0f",
	},
	webdl: {
		...base,
		background: "linear-gradient(135deg, #001f1f 0%, #003333 100%)",
		color: "#2dd4bf",
		border: "1px solid #0f766e55",
		boxShadow: "0 0 12px #0f766e22, inset 0 1px 0 #ffffff0f",
	},
	remux: {
		...base,
		background: "linear-gradient(135deg, #101000 0%, #1f1e00 100%)",
		color: "#facc15",
		border: "1px solid #a1680055",
		boxShadow: "0 0 12px #a1680022, inset 0 1px 0 #ffffff0f",
	},
	hevc: {
		...base,
		background: "linear-gradient(135deg, #0f1500 0%, #1a2200 100%)",
		color: "#a3e635",
		border: "1px solid #65a30d55",
		boxShadow: "0 0 12px #65a30d22, inset 0 1px 0 #ffffff0f",
	},
	av1: {
		...base,
		background: "linear-gradient(135deg, #0f0500 0%, #1f0d00 100%)",
		color: "#fb7f24",
		border: "1px solid #ea580c55",
		boxShadow: "0 0 12px #ea580c22, inset 0 1px 0 #ffffff0f",
	},
};

function Chip({
	s,
	icon,
	label,
}: {
	s: CSSProperties;
	icon: ReactNode;
	label: string;
}) {
	return (
		<span style={s} className="media-chip">
			{icon}
			{label}
		</span>
	);
}

const Icons = {
	Atmos: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h6a8 8 0 0 1 0 16H5V4z" fill="currentColor" opacity="0.25"/>
      <path d="M5 4h6a8 8 0 0 1 0 16H5V4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <path d="M15.5 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M17.5 7a7 7 0 0 1 0 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.5"/>
    </svg>
	),
	TrueHD: () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 4h6a8 8 0 0 1 0 16H5V4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M5 8h5a4 4 0 0 1 0 8H5V8z" fill="currentColor" opacity="0.3"/>
      </svg>
	),
	DTS: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<rect x="2" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.4" />
			<rect x="6" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.6" />
			<rect x="10" y="3" width="3" height="18" rx="1" fill="currentColor" />
			<rect x="14" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.6" />
			<rect x="18" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.4" />
		</svg>
	),
	EAC3: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<path
				d="M5 4h6a8 8 0 0 1 0 16H5V4z"
				stroke="currentColor"
				strokeWidth="1.5"
				fill="none"
			/>
			<path
				d="M13 12h6M16 9v6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	),
	FLAC: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<path
				d="M3 17 Q6 7 9 12 Q12 17 15 8 Q18 0 21 10"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				fill="none"
			/>
			<path
				d="M3 20h18"
				stroke="currentColor"
				strokeWidth="1"
				strokeLinecap="round"
				opacity="0.3"
			/>
		</svg>
	),
	DoVi: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke="currentColor"
				strokeWidth="1.5"
				fill="none"
			/>
			<path d="M8 9l8 3-8 3V9z" fill="currentColor" />
			<circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3" />
		</svg>
	),
	HDR: () => (
		<svg width="15" height="14" viewBox="0 0 26 24" fill="none">
			<circle cx="13" cy="12" r="4" fill="currentColor" opacity="0.8" />
			<line x1="13" y1="2" x2="13" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="13" y1="19" x2="13" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="20" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="5.9" y1="5.9" x2="8" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="18" y1="16" x2="20.1" y2="18.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="5.9" y1="18.1" x2="8" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="18" y1="8" x2="20.1" y2="5.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
		</svg>
	),
	HDR10Plus: () => (
		<svg width="15" height="14" viewBox="0 0 26 24" fill="none">
			<circle cx="11" cy="12" r="4" fill="currentColor" opacity="0.8" />
			<line x1="11" y1="2" x2="11" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="11" y1="19" x2="11" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="1" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="4" y1="5.9" x2="6.1" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="15.9" y1="16" x2="18" y2="18.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="4" y1="18.1" x2="6.1" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="15.9" y1="8" x2="18" y2="5.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="22" y1="8" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="19" y1="11" x2="25" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	),
	HLG: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<path
				d="M3 20 Q7 20 10 12 Q13 4 21 4"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				fill="none"
			/>
			<circle
				cx="12"
				cy="12"
				r="2.5"
				stroke="currentColor"
				strokeWidth="1.3"
				fill="none"
				opacity="0.6"
			/>
		</svg>
	),
	FourK: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
			<text x="5" y="15.5" fontSize="7" fontWeight="700" fontFamily="Rajdhani,sans-serif" fill="currentColor">
				4K
			</text>
		</svg>
	),
	Bluray: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
			<circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
			<circle cx="12" cy="12" r="1.5" fill="currentColor" />
			<line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
		</svg>
	),
	WebDL: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
			<path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
			<path d="M9 15l3 3 3-3M12 18v-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	),
	Remux: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4" />
			<path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
			<path d="M2 7l10 5 10-5-10-5-10 5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
		</svg>
	),
	HEVC: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
			<line x1="10" y1="4" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="14" y1="4" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="10" y1="17" x2="10" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="14" y1="17" x2="14" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="4" y1="14" x2="7" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="17" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="17" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	),
	AV1: () => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
			<rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
			<line x1="10" y1="4" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="14" y1="4" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="10" y1="17" x2="10" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="14" y1="17" x2="14" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="4" y1="14" x2="7" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="17" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<line x1="17" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
			<circle cx="12" cy="12" r="1.5" fill="currentColor" />
		</svg>
	),
};

const BLURAY_SOURCES = new Set(["Bluray", "UHDBD", "MBluray", "BDRip"]);

export function MediaChips({
	releaseData,
}: {
	releaseData: ReleaseData | null | undefined;
}) {
	if (!releaseData) return null;

	const { source, format, resolution, audio, flags } = releaseData;
	const flagSet = new Set(flags ?? []);
	const chips: ReactNode[] = [];

	if (resolution && ["2160p", "UHD", "4320p"].includes(resolution)) {
		chips.push(
			<Chip key="4k" s={S["4k"]} icon={<Icons.FourK />} label="4K UHD" />,
		);
	}

	if (source) {
		if (BLURAY_SOURCES.has(source)) {
			chips.push(
				<Chip key="bluray" s={S.bluray} icon={<Icons.Bluray />} label="Blu-ray" />,
			);
		} else if (source === "WEB") {
			chips.push(
				<Chip key="webdl" s={S.webdl} icon={<Icons.WebDL />} label="WEB-DL" />,
			);
		}
	}

	if (flagSet.has("Remux")) {
		chips.push(
			<Chip key="remux" s={S.remux} icon={<Icons.Remux />} label="REMUX" />,
		);
	}

	if (flagSet.has("Dolby Vision")) {
		chips.push(
			<Chip key="dovi" s={S.dovi} icon={<Icons.DoVi />} label="DoVi" />,
		);
	}

	if (flagSet.has("HDR10+")) {
		chips.push(
			<Chip key="hdr10plus" s={S.hdr10plus} icon={<Icons.HDR10Plus />} label="HDR10+" />,
		);
	} else if (flagSet.has("HDR10")) {
		chips.push(
			<Chip key="hdr10" s={S.hdr} icon={<Icons.HDR />} label="HDR10" />,
		);
	} else if (flagSet.has("HDR")) {
		chips.push(
			<Chip key="hdr" s={S.hdr} icon={<Icons.HDR />} label="HDR" />,
		);
	}

	if (flagSet.has("HLG")) {
		chips.push(
			<Chip key="hlg" s={S.hlg} icon={<Icons.HLG />} label="HLG" />,
		);
	}

	if (format) {
		if (["x265", "HEVC", "h265"].includes(format)) {
			chips.push(
				<Chip key="hevc" s={S.hevc} icon={<Icons.HEVC />} label="x265 / HEVC" />,
			);
		} else if (format === "AV1") {
			chips.push(
				<Chip key="av1" s={S.av1} icon={<Icons.AV1 />} label="AV1" />,
			);
		} else if (format === "FLAC") {
			chips.push(
				<Chip key="flac" s={S.flac} icon={<Icons.FLAC />} label="FLAC" />,
			);
		}
	}

	if (audio) {
		if (
			audio === "Dolby Atmos" ||
			audio === "Dolby Digital Plus, Dolby Atmos"
		) {
			chips.push(
				<Chip key="atmos" s={S.atmos} icon={<Icons.Atmos />} label="Dolby Atmos" />,
			);
		} else if (audio === "Dolby trueHD") {
			chips.push(
				<Chip key="truehd" s={S.truehd} icon={<Icons.TrueHD />} label="TrueHD" />,
			);
		} else if (audio === "DTS-HD MA" || audio === "DTS-HD") {
			chips.push(
				<Chip key="dts" s={S.dts} icon={<Icons.DTS />} label="DTS-HD MA" />,
			);
		} else if (
			audio === "EAC3" ||
			audio === "EAC3D" ||
			audio === "Dolby Digital Plus" ||
			audio === "AC3D"
		) {
			chips.push(
				<Chip key="eac3" s={S.eac3} icon={<Icons.EAC3 />} label="DD+" />,
			);
		}
	}

	if (chips.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2">
			{chips}
		</div>
	);
}
