import type { Metadata } from "next";
import { FigmaPluginDoc } from "@/components/FigmaPluginDoc";

const SITE = "https://avatars.outpacestudios.com";
const URL = `${SITE}/figma-plugin`;

const DESCRIPTION =
	"The Avatars Figma plugin. Type a seed and get the same generative gradient avatar the web renders, as native, editable Figma layers. Download and import it into the Figma desktop app.";
const OG_DESCRIPTION =
	"Type a seed and get the same generative gradient avatar the web renders, as native, editable Figma layers. No account, no network.";

// Next.js replaces `openGraph`/`twitter` per segment wholesale (no deep merge
// with layout.tsx), so both must be defined in full here.
export const metadata: Metadata = {
	title: "Figma plugin",
	description: DESCRIPTION,
	alternates: { canonical: URL },
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "@outpacelabs/avatars",
		title: "Figma plugin | @outpacelabs/avatars",
		description: OG_DESCRIPTION,
		url: URL,
		images: [
			{
				url: "/meta.jpg",
				width: 1200,
				height: 630,
				alt: "@outpacelabs/avatars, by Outpace Studios",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Figma plugin | @outpacelabs/avatars",
		description: OG_DESCRIPTION,
		images: ["/meta.jpg"],
		site: "@outpacestudios",
		creator: "@outpacestudios",
	},
};

// Page-scoped structured data: a breadcrumb and a SoftwareApplication for the
// plugin. The download is a free zip for the Figma desktop app.
const jsonLd = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "BreadcrumbList",
			"@id": `${URL}/#breadcrumbs`,
			itemListElement: [
				{ "@type": "ListItem", position: 1, name: "Home", item: SITE },
				{ "@type": "ListItem", position: 2, name: "Figma plugin", item: URL },
			],
		},
		{
			"@type": "SoftwareApplication",
			"@id": `${URL}/#app`,
			name: "Avatars for Figma",
			description: OG_DESCRIPTION,
			applicationCategory: "DesignApplication",
			operatingSystem: "Figma",
			downloadUrl: `${SITE}/avatars-figma-plugin.zip`,
			softwareRequirements: "Figma desktop app",
			isAccessibleForFree: true,
			offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
			license: "https://opensource.org/license/mit",
		},
	],
};

export default function FigmaPluginPage() {
	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<FigmaPluginDoc />
		</>
	);
}
