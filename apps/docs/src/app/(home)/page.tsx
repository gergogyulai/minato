import { DeploymentCards } from "@/components/landing/deployment-cards";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { FinalCTA } from "@/components/landing/final-cta";
import { HeroSection } from "@/components/landing/hero";
import { LandingMotion } from "@/components/landing/motion";
import { SdkSection } from "@/components/landing/sdk-section";
import { UnderTheHood } from "@/components/landing/under-the-hood";

export default function HomePage() {
	return (
		<LandingMotion>
			<div className="bg-web-bg">
				<HeroSection />
				<FeaturesGrid />
				<UnderTheHood />
				<SdkSection />
				<DeploymentCards />
				<FinalCTA />
			</div>
		</LandingMotion>
	);
}
