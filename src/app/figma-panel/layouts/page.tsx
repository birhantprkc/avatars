import type { Metadata } from "next";
import { FigmaPanelLayouts } from "@/components/figma-panel/layouts";

export const metadata: Metadata = {
	title: "Figma panel · layouts",
	description: "Three layout options for the Avatars Figma plugin panel.",
	// Internal UI demo, keep it out of search results and out of the nav.
	robots: { index: false, follow: false },
};

export default function FigmaPanelLayoutsPage() {
	return <FigmaPanelLayouts />;
}
