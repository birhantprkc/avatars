/**
 * Site design tokens, extracted from the live surfaces.
 *
 * Source of truth is the real UI: `/create` (CreateContent), the header
 * (SiteHeader), and the pattern switch (PatternSwitch). The plugin panel and
 * its Next.js demo both build on these, so the panel reads as part of the site
 * and not a look-alike.
 *
 * Two forms live here. `alpha`, `font`, and `type` are JS values for
 * inline-styled bits (the same pattern CreateContent uses with INK/BODY/MONO).
 * `cls` holds the Tailwind class strings for the surfaces and controls, so the
 * one on-brand value has one home.
 *
 * The brand is a monochrome language: white at graded opacity on black. No
 * borders on cards, hairlines instead. Frosted squircle cards, pill controls,
 * a single white pill for the primary action.
 */

/** White at graded opacity. The whole palette is one hue: white on black. */
export const alpha = {
	/** Primary text and active control labels. */
	ink: "rgba(255,255,255,0.92)",
	/** The brightest ink, nav and the primary pill's label. */
	inkStrong: "rgba(255,255,255,0.96)",
	/** Input text. */
	inkInput: "rgba(255,255,255,0.88)",
	/** Body copy. */
	body: "rgba(255,255,255,0.62)",
	/** Labels, value readouts, secondary hints. */
	muted: "rgba(255,255,255,0.42)",
	/** Placeholder text, the faintest legible step. */
	faint: "rgba(255,255,255,0.28)",
} as const;

export const font = {
	/** Inter variable, self-hosted via next/font, weights 100-900. */
	sans: "var(--font-display)",
	/** Geist Mono, for values, code, and small uppercase labels. */
	mono: "var(--font-geist-mono), ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/** Reusable inline type styles, matched to the live surfaces. */
export const type = {
	/** Control label. Inter 13 / 450. */
	label: {
		fontFamily: font.sans,
		fontSize: 13,
		fontWeight: 450,
		lineHeight: "20px",
		color: alpha.ink,
	},
	/** Value readout beside a label. Geist Mono 12, tabular. */
	value: {
		fontFamily: font.mono,
		fontSize: 12,
		lineHeight: "20px",
		color: alpha.muted,
		fontVariantNumeric: "tabular-nums",
	},
	/** Tiny uppercase caption, the preview's corner labels. */
	caption: {
		fontFamily: font.mono,
		fontSize: 10,
		letterSpacing: "0.04em",
		textTransform: "uppercase",
		color: alpha.muted,
	},
	/** Body paragraph. Inter 14 / 1.72. */
	body: {
		fontFamily: font.sans,
		fontSize: 14,
		lineHeight: 1.72,
		letterSpacing: "0.1px",
		color: alpha.body,
	},
} as const;

/** Corner radii in px. Cards carry 60% corner smoothing (useSmoothCorners). */
export const radius = {
	card: 20,
	code: 16,
	input: 10,
	/** Figma's corner smoothing amount, 0..1, for squircle paths. */
	smoothing: 0.6,
} as const;

/** Shared entrance motion, the site's one curve. */
export const motion = {
	easeOut: [0.22, 1, 0.36, 1] as const,
	reveal: 0.28,
} as const;

/**
 * Tailwind class strings for the surfaces and controls. One on-brand value,
 * one name. Compose these instead of retyping opacities.
 */
export const cls = {
	/** Frosted card. Borderless, a hairline separates its inner groups. */
	card: "bg-white/[0.04]",
	/** Raised control surface: inputs, the segmented well. */
	raise: "bg-white/[0.06]",
	/** Hover lift on a ghost control. */
	raiseHover: "hover:bg-white/[0.08]",
	/** Hairline between control groups inside a card. */
	divide: "border-white/[0.06]",
	/** Segmented pill: the well, and the active thumb. */
	seg: "rounded-full bg-white/[0.06] p-1",
	segActive: "bg-white/[0.14] text-white/[0.92]",
	segIdle: "text-white/[0.48] hover:text-white/[0.8]",
	/** Text input. */
	input:
		"rounded-[10px] bg-white/[0.06] text-white/[0.88] placeholder:text-white/[0.28]",
	/** Primary action, the one white pill. */
	primary: "rounded-full bg-white text-black hover:bg-white/[0.88]",
	/** Secondary action, a frosted pill. */
	secondary: "rounded-full bg-white/[0.06] text-white/[0.62] hover:bg-white/[0.08]",
} as const;
