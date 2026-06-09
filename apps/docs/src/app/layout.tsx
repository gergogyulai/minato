import { RootProvider } from "fumadocs-ui/provider/next";

import "./global.css";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const bricolage = Bricolage_Grotesque({
	subsets: ["latin"],
	variable: "--font-bricolage",
	weight: ["500", "600", "700", "800"],
});

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className={`${geist.className} ${geistMono.variable} ${bricolage.variable}`}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<RootProvider theme={{ defaultTheme: "dark" }}>
					{children}
				</RootProvider>
			</body>
		</html>
	);
}
