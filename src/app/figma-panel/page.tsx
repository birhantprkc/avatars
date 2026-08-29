import type { Metadata } from "next";
import { FigmaPanelSplitPage } from "@/components/figma-panel/layouts";

export const metadata: Metadata = {
	title: "Figma panel",
	description: "A Next.js demo of the Avatars Figma plugin panel.",
	// Internal UI demo, keep it out of search results and out of the nav.
	robots: { index: false, follow: false },
};

export default function FigmaPanelPage() {
	return <FigmaPanelSplitPage />;
}
