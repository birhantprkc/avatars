"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { ControlsStack, SplitEditor } from "@/components/figma-panel/layouts";
import { RangeStyle } from "@/components/figma-panel/shared";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useSmoothCorners } from "@/lib/utils/useSmoothCorners";

/*
 * Documentation for the Avatars Figma plugin, in the same reading style as the
 * package docs: a thin ~640px column, small understated type, generous section
 * spacing, borderless rounded surfaces, dark mode. The one wide element is the
 * live panel, the exact editor the plugin ships, centered above the prose.
 */

const INK = "rgba(255,255,255,0.92)";
const BODY = "rgba(255,255,255,0.62)";
const MUTED = "rgba(255,255,255,0.42)";
const MONO =
	"var(--font-geist-mono), ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

const REPO_HREF =
	"https://github.com/outpacelabs/avatars/tree/main/packages/figma-plugin";
/** The Figma Community listing for the plugin. */
const FIGMA_PLUGIN_HREF =
	"https://www.figma.com/community/plugin/1675274747793532564/avatars-by-outpace-studios";

function Col({ children, center }: { children: ReactNode; center?: boolean }) {
	const reduced = useReducedMotion() ?? false;
	return (
		<motion.div
			style={{
				maxWidth: 640,
				margin: "0 auto",
				textAlign: center ? "center" : undefined,
			}}
			initial={reduced ? false : { opacity: 0, y: 12 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "0px 0px -64px 0px" }}
			transition={
				reduced ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
			}
		>
			{children}
		</motion.div>
	);
}

function H2({ children }: { children: ReactNode }) {
	return (
		<h2
			style={{
				fontSize: 15,
				fontWeight: 450,
				color: INK,
				letterSpacing: "-0.1px",
				margin: "80px 0 0",
				textWrap: "balance",
			}}
		>
			{children}
		</h2>
	);
}

function H3({ children }: { children: ReactNode }) {
	return (
		<h3
			style={{
				fontSize: 14,
				fontWeight: 450,
				color: INK,
				letterSpacing: "-0.1px",
				margin: "40px 0 0",
				textWrap: "balance",
			}}
		>
			{children}
		</h3>
	);
}

function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
	return (
		<p
			style={{
				fontSize: 14,
				lineHeight: 1.72,
				letterSpacing: "0.1px",
				color: muted ? MUTED : BODY,
				margin: "16px 0 0",
				textWrap: "pretty",
			}}
		>
			{children}
		</p>
	);
}

/* Inline code. */
function C({ children }: { children: ReactNode }) {
	return (
		<code
			style={{
				fontFamily: MONO,
				fontSize: "0.84em",
				background: "rgba(255,255,255,0.05)",
				borderRadius: 6,
				padding: "3px 5px",
				color: INK,
			}}
		>
			{children}
		</code>
	);
}

function A({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			style={{
				color: INK,
				textDecoration: "underline",
				textDecorationColor: "rgba(255,255,255,0.9)",
				textUnderlineOffset: "2px",
			}}
		>
			{children}
		</a>
	);
}

/** The control reference: one row per control group. */
const CONTROLS: { name: string; desc: ReactNode }[] = [
	{
		name: "Seeds",
		desc: "One seed per line. Each seed is a unique avatar, and the same seed always renders the same one. With no selection, the seed lines set how many avatars go in.",
	},
	{
		name: "Pattern",
		desc: "Mesh is the signature soft gradient. Dither is a crisp ordered dither of the same palette, with no blur.",
	},
	{
		name: "Detail",
		desc: "How many colors and shapes each avatar gets. A low value is one clean mark. A high value is the full palette and detail.",
	},
	{
		name: "Shape",
		desc: "Circle, Rounded, or Square. Rounded adds a radius slider, so you set the corner as a percent.",
	},
	{
		name: "Output",
		desc: "Layers gives native, editable Figma vector layers. Image gives a flat PNG. Both come from one seed, so they match.",
	},
];

export function FigmaPluginDoc() {
	const panelRef = useSmoothCorners<HTMLDivElement>(24);
	const [showTopBlur, setShowTopBlur] = useState(false);

	// Fade in the top scroll gradient once the page has scrolled, the same mask
	// the home and docs pages use so the sticky header never shows content
	// through it.
	useEffect(() => {
		const onScroll = () => setShowTopBlur(window.scrollY > 50);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<div
			style={{
				position: "relative",
				minHeight: "100vh",
				paddingBottom: 96,
				overflowX: "clip",
			}}
		>
			<div
				className={`fixed top-0 left-0 right-0 h-[80px] z-[5] pointer-events-none transition-opacity duration-300 ${
					showTopBlur ? "opacity-100" : "opacity-0"
				}`}
				style={{
					background:
						"linear-gradient(to bottom, #0a0a0a 0%, transparent 100%)",
				}}
			/>
			<RangeStyle />
			<div className="flex flex-col items-center w-full pt-3 gap-6">
				<section className="w-full px-6 flex flex-col gap-3">
					<SiteHeader />

					<div
						className="pt-14 sm:pt-20"
						style={{ maxWidth: 1080, margin: "0 auto", width: "100%" }}
					>
						<main>
							{/* Hero: title, one line, the Figma call to action, the live panel. */}
							<section>
								<Col center>
									<h1
										style={{
											fontSize: 28,
											fontWeight: 550,
											lineHeight: 1.2,
											letterSpacing: "-0.4px",
											color: INK,
											textWrap: "balance",
										}}
									>
										Avatars for Figma
									</h1>
									<P>
										The same engine the web component uses, as a Figma plugin.
										Type a seed and get the exact avatar the site renders, as
										native Figma layers you can open, recolor, and pull apart.
									</P>
									<div
										style={{
											display: "flex",
											flexWrap: "wrap",
											alignItems: "center",
											justifyContent: "center",
											gap: 12,
											margin: "26px 0 0",
										}}
									>
										<a
											href={FIGMA_PLUGIN_HREF}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex h-11 items-center rounded-full bg-white pl-5 pr-5 text-sm font-[550] leading-none text-black transition hover:bg-white/90 motion-safe:active:scale-[0.98]"
										>
											Get the plugin
										</a>
									</div>
								</Col>

								{/* The real editor the plugin ships. Overflows to scroll on a
								    narrow screen so its fixed 640px frame never crops. `safe
								    center` centers it where it fits, but aligns to the start
								    when it overflows, so the left edge stays reachable. */}
								<div
									style={{
										margin: "40px 0 0",
										display: "flex",
										justifyContent: "safe center",
										overflowX: "auto",
									}}
								>
									<div ref={panelRef} style={{ flex: "none" }}>
										<SplitEditor Controls={ControlsStack} />
									</div>
								</div>
							</section>

							{/* Install */}
							<section>
								<Col>
									<H2>Install</H2>
									<P>
										The plugin is on the Figma Community.{" "}
										<A href={FIGMA_PLUGIN_HREF}>Open the listing</A> and run it
										in any file. It works in the browser and in the desktop app,
										with no manual step.
									</P>
								</Col>
							</section>

							{/* The panel */}
							<section>
								<Col>
									<H2>Using the panel</H2>
									<P>
										The panel has two halves. On the left is a grid of seed
										cards, one avatar each. On the right are the controls and
										the action buttons. Edit a seed and its card updates on the
										spot.
									</P>
									<div
										style={{
											margin: "22px 0 0",
											borderRadius: 16,
											overflow: "hidden",
											background: "rgba(255,255,255,0.04)",
										}}
									>
										{CONTROLS.map((ctl, i) => (
											<div
												key={ctl.name}
												style={{
													display: "grid",
													gridTemplateColumns: "108px 1fr",
													gap: 16,
													padding: "14px 16px",
													borderTop:
														i === 0
															? undefined
															: "1px solid rgba(255,255,255,0.06)",
												}}
											>
												<span style={{ color: INK, fontSize: 13 }}>
													{ctl.name}
												</span>
												<span
													style={{ color: BODY, fontSize: 13, lineHeight: 1.5 }}
												>
													{ctl.desc}
												</span>
											</div>
										))}
									</div>
								</Col>
							</section>

							{/* Insert vs fill */}
							<section>
								<Col>
									<H2>Insert and Fill selection</H2>
									<P>
										The two action buttons decide where the avatars land. The
										selection decides how many.
									</P>
									<H3>Insert</H3>
									<P>
										Insert makes new avatars on the page. With a selection, the
										count follows it. Select six frames and Insert makes six
										avatars, one per layer, each seeded from that layer&apos;s
										own name. With no selection, the seed lines set the count
										instead. One avatar goes in on its own. Several go in as a
										tidy row.
									</P>
									<H3>Fill selection</H3>
									<P>
										Fill selection paints the avatars into the shapes you
										already have, rather than into new ones. So a page of
										placeholders named after real people fills itself in one
										click, whatever shape those placeholders are.
									</P>
									<P muted>
										A named layer is always its own seed, so the same frame name
										gives the same avatar in every file. Only an unnamed layer
										borrows a typed seed.
									</P>
								</Col>
							</section>

							{/* Layers */}
							<section>
								<Col>
									<H2>Layers, not a picture</H2>
									<P>
										With <C>Layers</C> output, an avatar arrives as real Figma
										vector layers, not a flat image. A mesh is about a dozen
										layers. A dither is three, still crisp and easy to recolor.
										The vector output and the image output come from one engine
										on one seed, so they always match.
									</P>
									<P>
										Give it your own palette and the seed still decides the
										layout, so every avatar stays unique and stays on brand.
									</P>
								</Col>
							</section>

							{/* No network */}
							<section>
								<Col>
									<H2>No network</H2>
									<P>
										The plugin never fetches or uploads. Every avatar is
										generated from its seed on the spot, which is the whole
										point of the library. The manifest declares no network
										access, so Figma blocks it either way.
									</P>
									<P muted>
										Display P3 is absent on purpose. The engine can paint it,
										but the Figma plugin API has no wide-gamut paint, so the
										option is left out rather than quietly dropped back to sRGB.
									</P>
								</Col>
							</section>

							{/* Source */}
							<section>
								<Col>
									<H2>Source and updates</H2>
									<P>
										The plugin is open source, in the same repository as the
										package. Read the code, file an issue, or build it yourself
										from the <A href={REPO_HREF}>packages/figma-plugin</A>{" "}
										folder. Free to use under the{" "}
										<A href="https://opensource.org/license/mit">MIT license</A>
										.
									</P>
									<div style={{ height: 40 }} />
								</Col>
							</section>
						</main>
					</div>
				</section>
			</div>

			<SiteFooter />
		</div>
	);
}
