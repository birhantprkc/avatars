import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { OrbitDemo } from "@/components/OrbitDemo";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Demo",
	description:
		"An orbital ring of generative gradient avatars. Scroll to spin the ring like a planet's ring; the front-center avatar can be copied or downloaded.",
	alternates: { canonical: `${SITE}/demo` },
	// Experimental demo, keep it out of search results for now.
	robots: { index: false, follow: true },
};

export default function DemoPage() {
	// GeistMono.variable exposes --font-geist-mono to the seed label.
	return (
		<div className={GeistMono.variable}>
			<OrbitDemo />
		</div>
	);
}
