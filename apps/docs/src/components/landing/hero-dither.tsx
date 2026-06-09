"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const GrainGradient = dynamic(
	() => import("@paper-design/shaders-react").then((m) => m.GrainGradient),
	{ ssr: false },
);

const Dithering = dynamic(
	() => import("@paper-design/shaders-react").then((m) => m.Dithering),
	{ ssr: false },
);

export function HeroDither() {
	const { resolvedTheme } = useTheme();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => setVisible(true), 300);
		return () => clearTimeout(t);
	}, []);

	const isDark = resolvedTheme !== "light";

	return (
		<div
			className="absolute inset-0 transition-opacity duration-[1.4s] ease-out"
			style={{ opacity: visible ? 1 : 0 }}
		>
			<GrainGradient
				className="absolute inset-0"
				colors={
					isDark
						? ["#0a1650", "#040c28", "#00000000"]
						: ["#c0cfff", "#dce6ff", "#ffffff00"]
				}
				colorBack="#00000000"
				softness={1}
				intensity={0.75}
				noise={0.4}
				speed={0.40}
				shape="corners"
				minPixelRatio={1}
				maxPixelCount={1920 * 1080}
			/>
			<Dithering
				width={680}
				height={680}
				colorBack="#00000000"
				colorFront={isDark ? "#3058d8" : "#2546c0"}
				shape="sphere"
				type="8x8"
				scale={0.55}
				size={2.9}
				speed={1}
				frame={7200}
				className="absolute top-[-10%] right-[-4%] opacity-70"
				minPixelRatio={1}
			/>
		</div>
	);
}
