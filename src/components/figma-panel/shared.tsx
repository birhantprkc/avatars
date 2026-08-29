"use client";

import { Plus, Shuffle, X } from "@keyline-icons/react";
import { tap as tapSound } from "@outpacelabs/audio";
import { AnimatePresence, motion } from "framer-motion";
import {
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { drawPattern, type Pattern } from "@/lib/avatars/patterns";
import { font, type } from "@/lib/design/tokens";
import { useSmoothCorners } from "@/lib/utils/useSmoothCorners";

/*
 * Shared parts for the Figma panel demo layouts.
 *
 * Every layout uses the same tokens, controls, engine, and state. Only the
 * arrangement changes. So the tokens, the seed cards, the segmented controls,
 * and the whole panel state live here once. A layout imports these and lays
 * them out its own way.
 *
 * Output is always 2048 px. So there is no size control. A Detail switch sets
 * the level of detail instead: it sets the `displaySize` the engine reads
 * (see `detailFor` in mesh-gradient.ts). Low is the simplest avatar, Max is
 * the full one. The corner radius is a percent of the side, so it no longer
 * depends on a size.
 */

export type { Pattern };
export type Shape = "circle" | "rounded" | "square";
export type Output = "layers" | "image";
/** Detail is a percent from 0 to 100. It drives the engine's detail ramp. */
export type Detail = number;

/** More than this in one insert and a Figma file stops being a pleasure. */
export const MAX_SEEDS = 24;
/** Blur radius as a fraction of display size, matches the baked-image look. */
const BLUR_FRACTION = 0.06;
/** Every avatar inserts at this pixel size. */
export const OUTPUT_PX = 2048;

/** A seed carries a stable id, so enter and exit animations key correctly. */
export type Seed = { id: string; value: string };

/** The first render uses this stable seed, so hydration stays clean. A mount
 * effect then swaps its value for a random string, so the demo opens fresh. */
const DEFAULT_SEED = "avatar";
const DEFAULT_SEEDS: Seed[] = [{ id: "seed-0", value: DEFAULT_SEED }];

/**
 * Detail runs from 0 to 100. It maps to a `displaySize` on the engine's detail
 * ramp. 16 px is the simplest look. 160 px is the full one. The ramp is
 * `16 * 10^(detail / 100)`, so detail moves evenly in ramp terms. The preview
 * boxes render at their own pixel size, but the detail follows this value.
 */
export const DETAIL_MIN = 0;
export const DETAIL_MAX = 100;
/** The slider snaps to this grid. A small step gives many stops. */
export const DETAIL_STEP = 5;

/** Turn a 0 to 100 detail into an engine `displaySize`. */
export function displaySizeForDetail(detail: number): number {
	return Math.round(16 * 10 ** (detail / 100));
}

/** Draw resolution for a shown size: above display size so the blur is smooth. */
function resolutionFor(px: number): number {
	return Math.max(128, Math.min(512, Math.round(px * 3)));
}

function randomSeed(): string {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * The corner radius for a preview box shown at `px`, in pixels. Every shape
 * returns a plain number, so the radius interpolates when the shape changes.
 * A circle is half the side, so it reads as fully round.
 */
function shapeRadiusPx(shape: Shape, px: number, radiusPct: number): number {
	if (shape === "circle") return px / 2;
	if (shape === "rounded") return Math.min(px / 2, (radiusPct / 100) * px);
	return 0;
}

/** One rendered avatar, cut to the chosen shape. */
export function ShapeAvatar({
	seed,
	px,
	pattern,
	shape,
	radiusPct,
	displaySize,
}: {
	seed: string;
	px: number;
	pattern: Pattern;
	shape: Shape;
	radiusPct: number;
	displaySize: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const resolution = resolutionFor(px);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, resolution, resolution);
		// The detail follows the Detail switch, not the preview box, so every
		// preview of one avatar shows the same detail.
		drawPattern(ctx, seed, resolution, pattern, { displaySize });
	}, [seed, pattern, resolution, displaySize]);

	const blur =
		pattern === "mesh" ? Math.max(1, Math.round(px * BLUR_FRACTION)) : 0;

	return (
		<motion.span
			className="relative block overflow-hidden bg-white/[0.04]"
			style={{ width: px, height: px }}
			initial={false}
			animate={{ borderRadius: shapeRadiusPx(shape, px, radiusPct) }}
			transition={{ type: "spring", stiffness: 500, damping: 40 }}
		>
			<canvas
				ref={canvasRef}
				width={resolution}
				height={resolution}
				style={{
					width: "100%",
					height: "100%",
					display: "block",
					filter: blur ? `blur(${blur}px)` : undefined,
				}}
			/>
		</motion.span>
	);
}

/* ── seed cards, the site's home-grid language ── */

/** One seed as a card: the avatar, plus an editable seed caption below it. */
export function SeedCard({
	seed,
	index,
	pattern,
	shape,
	radiusPct,
	displaySize,
	avatarPx,
	canRemove,
	onChange,
	onRemove,
	autoFocus,
}: {
	seed: string;
	index: number;
	pattern: Pattern;
	shape: Shape;
	radiusPct: number;
	displaySize: number;
	avatarPx: number;
	canRemove: boolean;
	onChange: (value: string) => void;
	onRemove: () => void;
	autoFocus: boolean;
}) {
	const cardRef = useSmoothCorners<HTMLDivElement>(16);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) inputRef.current?.select();
	}, [autoFocus]);

	return (
		<div
			ref={cardRef}
			onClick={() => inputRef.current?.focus()}
			className="group relative flex aspect-[7/8] cursor-text flex-col items-center justify-between rounded-[16px] bg-white/[0.04] px-3 pb-3 pt-6 transition-colors hover:bg-white/[0.06]"
		>
			{canRemove && (
				<button
					type="button"
					title="Remove seed"
					aria-label={`Remove seed ${index + 1}`}
					onClick={(e) => {
						e.stopPropagation();
						tapSound();
						onRemove();
					}}
					className="absolute right-1.5 top-1.5 z-[1] grid size-6 cursor-pointer place-items-center rounded-full text-white/[0.4] opacity-0 transition hover:bg-white/[0.1] hover:text-white/[0.88] focus-visible:opacity-100 group-hover:opacity-100"
				>
					<X size={13} aria-hidden="true" />
				</button>
			)}
			<ShapeAvatar
				seed={seed.trim() || " "}
				px={avatarPx}
				pattern={pattern}
				shape={shape}
				radiusPct={radiusPct}
				displaySize={displaySize}
			/>
			<input
				ref={inputRef}
				value={seed}
				onChange={(e) => onChange(e.target.value)}
				spellCheck={false}
				autoComplete="off"
				placeholder="seed"
				aria-label={`Seed ${index + 1}`}
				style={{ fontFamily: font.mono }}
				className="w-full min-w-0 rounded-[8px] bg-transparent px-1.5 py-1.5 text-center text-[11px] leading-4 text-white/[0.62] transition-colors placeholder:text-white/[0.28] focus:text-white/[0.88] focus:outline-none"
			/>
		</div>
	);
}

/** The empty card. Clicking it adds a seed. */
export function AddCard({ onAdd }: { onAdd: () => void }) {
	const cardRef = useSmoothCorners<HTMLButtonElement>(16);
	return (
		<button
			ref={cardRef}
			type="button"
			title="Add seed"
			aria-label="Add seed"
			onClick={() => {
				tapSound();
				onAdd();
			}}
			className="group grid size-full aspect-[7/8] cursor-pointer place-items-center rounded-[16px] bg-white/[0.02] text-white/[0.4] transition-colors hover:bg-white/[0.05] hover:text-white/[0.88] motion-safe:active:scale-[0.99]"
		>
			<Plus size={22} aria-hidden="true" />
		</button>
	);
}

/* ── controls, all in the site's language ── */

export function GroupLabel({
	children,
	value,
}: {
	children: React.ReactNode;
	value?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span style={type.label} className="leading-5">
				{children}
			</span>
			{value !== undefined && (
				<span
					style={type.value}
					className="leading-5 tabular-nums whitespace-nowrap"
				>
					{value}
				</span>
			)}
		</div>
	);
}

export function Segmented<T extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: { value: T; label: string; icon?: ReactNode }[];
	value: T;
	onChange: (v: T) => void;
	label: string;
}) {
	// One shared pill per group. It slides to the active option.
	const pillId = useId();
	return (
		<fieldset
			aria-label={label}
			className="flex min-w-0 rounded-full bg-white/[0.06] p-1"
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<button
						key={opt.value}
						type="button"
						aria-pressed={active}
						onClick={() => {
							if (!active) {
								tapSound();
								onChange(opt.value);
							}
						}}
						className={`relative min-w-0 flex-1 cursor-pointer rounded-full px-2.5 py-1.5 text-[13px] font-[550] leading-5 transition-colors ${
							active ? "text-white/[0.92]" : "text-white/[0.48] hover:text-white/[0.8]"
						}`}
					>
						{active && (
							<motion.span
								layoutId={`${pillId}-pill`}
								transition={{ type: "spring", stiffness: 500, damping: 40 }}
								className="absolute inset-0 rounded-full bg-white/[0.14]"
							/>
						)}
						<span className="relative z-[1] inline-flex items-center justify-center gap-1.5">
							{opt.icon}
							{opt.label}
						</span>
					</button>
				);
			})}
		</fieldset>
	);
}

export function Slider({
	value,
	min,
	max,
	onChange,
	label,
}: {
	value: number;
	min: number;
	max: number;
	onChange: (v: number) => void;
	label: string;
}) {
	const pct = ((value - min) / (max - min)) * 100;
	return (
		<input
			type="range"
			className="fp-range"
			aria-label={label}
			min={min}
			max={max}
			step={1}
			value={value}
			onChange={(e) => onChange(Number(e.target.value))}
			style={{
				background: `linear-gradient(to right, rgba(255,255,255,0.72) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
			}}
		/>
	);
}

/**
 * Detail as a plain fill slider. It snaps to a small step, so it has many
 * stops. It uses the same skin as the radius slider, so both read the same.
 * The value shows in the group header, not on the track.
 */
export function DetailSlider({
	value,
	onChange,
}: {
	value: Detail;
	onChange: (v: Detail) => void;
}) {
	const pct = ((value - DETAIL_MIN) / (DETAIL_MAX - DETAIL_MIN)) * 100;
	return (
		<input
			type="range"
			className="fp-range block"
			aria-label="Detail level"
			min={DETAIL_MIN}
			max={DETAIL_MAX}
			step={DETAIL_STEP}
			value={value}
			onChange={(e) => {
				const next = Number(e.target.value);
				if (next !== value) {
					tapSound();
					onChange(next);
				}
			}}
			style={{
				background: `linear-gradient(to right, rgba(255,255,255,0.72) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
			}}
		/>
	);
}

/** The range thumb skin, same white-on-dark thumb as /create. Render once. */
export function RangeStyle() {
	return (
		<style>{`
.fp-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;outline:none;cursor:pointer}
.fp-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:99px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab}
.fp-range::-webkit-slider-thumb:active{cursor:grabbing}
.fp-range::-moz-range-thumb{width:16px;height:16px;border:none;border-radius:99px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab}
.fp-range:focus-visible{outline:2px solid rgba(255,255,255,0.4);outline-offset:4px}`}</style>
	);
}

/** The white primary pill and its disabled twin, shared by every layout. */
export function InsertButtons({
	label,
	onInsert,
	className = "",
}: {
	label: string;
	onInsert: () => void;
	className?: string;
}) {
	return (
		<div className={`flex gap-2 ${className}`}>
			<button
				type="button"
				onClick={onInsert}
				className="flex-1 cursor-pointer rounded-full bg-white px-4 py-2.5 text-[13px] font-[550] leading-5 text-black transition hover:bg-white/[0.88] motion-safe:active:scale-[0.99]"
			>
				{label}
			</button>
			<button
				type="button"
				disabled
				className="flex-1 cursor-not-allowed rounded-full bg-white/[0.06] px-4 py-2.5 text-[13px] font-[550] leading-5 text-white/[0.62] opacity-50"
			>
				Fill selection
			</button>
		</div>
	);
}

/** On-brand confirmation pill, same language as the site Toast. */
export function Toast({ message }: { message: string | null }) {
	return (
		<div className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
			<AnimatePresence>
				{message && (
					<motion.div
						initial={{ opacity: 0, y: 16, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8 }}
						transition={{ type: "spring", stiffness: 500, damping: 30 }}
						className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.12] px-[14px] py-2 backdrop-blur-[12px]"
					>
						<span className="text-sm font-medium leading-5 tracking-[0.14px] text-white/[0.88]">
							{message}
						</span>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

/** The shuffle-all button, used in every seed header. */
export function ShuffleButton({ onShuffle }: { onShuffle: () => void }) {
	return (
		<button
			type="button"
			title="Shuffle all seeds"
			aria-label="Shuffle all seeds"
			onClick={onShuffle}
			className="group -mr-1 shrink-0 cursor-pointer rounded-[7px] p-1.5 transition hover:bg-white/[0.08] motion-safe:active:scale-95"
		>
			<span className="block text-white/[0.56] transition-colors group-hover:text-white/[0.88]">
				<Shuffle size={14} aria-hidden="true" />
			</span>
		</button>
	);
}

/* ── options ── */

// The two pattern glyphs, matched to the plugin's Pattern control: a soft
// gradient swatch for the mesh, a checkerboard clipped to a circle for the
// dither. Both draw in currentColor, so they dim and brighten with the label.
const MeshGlyph = (
	<svg
		width="16"
		height="16"
		viewBox="0 0 18 18"
		fill="none"
		aria-hidden="true"
	>
		<defs>
			<linearGradient
				id="pf-grad"
				x1="3"
				y1="3"
				x2="15"
				y2="15"
				gradientUnits="userSpaceOnUse"
			>
				<stop stopColor="currentColor" stopOpacity="0.25" />
				<stop offset="1" stopColor="currentColor" />
			</linearGradient>
		</defs>
		<circle cx="9" cy="9" r="6.5" fill="url(#pf-grad)" />
	</svg>
);
const DitherGlyph = (
	<svg
		width="16"
		height="16"
		viewBox="0 0 18 18"
		fill="none"
		aria-hidden="true"
	>
		<clipPath id="pf-dither-round">
			<circle cx="9" cy="9" r="6.5" />
		</clipPath>
		<g clipPath="url(#pf-dither-round)" fill="currentColor">
			<rect x="2.5" y="2.5" width="3.55" height="3.55" />
			<rect x="9" y="2.5" width="3.55" height="3.55" />
			<rect x="5.75" y="5.75" width="3.55" height="3.55" />
			<rect x="12.25" y="5.75" width="3.55" height="3.55" />
			<rect x="2.5" y="9" width="3.55" height="3.55" />
			<rect x="9" y="9" width="3.55" height="3.55" />
			<rect x="5.75" y="12.25" width="3.55" height="3.55" />
			<rect x="12.25" y="12.25" width="3.55" height="3.55" />
		</g>
	</svg>
);

export const PATTERN_OPTIONS: {
	value: Pattern;
	label: string;
	icon?: ReactNode;
}[] = [
	{ value: "mesh", label: "Mesh", icon: MeshGlyph },
	{ value: "dither", label: "Dither", icon: DitherGlyph },
];
export const SHAPE_OPTIONS: { value: Shape; label: string }[] = [
	{ value: "circle", label: "Circle" },
	{ value: "rounded", label: "Rounded" },
	{ value: "square", label: "Square" },
];
export const OUTPUT_OPTIONS: { value: Output; label: string }[] = [
	{ value: "layers", label: "Layers" },
	{ value: "image", label: "Image" },
];

/* ── panel state, one hook every layout shares ── */

export function usePanelState() {
	const [seeds, setSeeds] = useState<Seed[]>(DEFAULT_SEEDS);
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const idRef = useRef(1);
	const nextId = () => `seed-${idRef.current++}`;

	// Open with a random seed. We do this after mount, so the first client
	// render matches the server, then the value changes to a fresh string.
	useEffect(() => {
		setSeeds((prev) =>
			prev.length === 1 && prev[0].value === DEFAULT_SEED
				? [{ id: prev[0].id, value: randomSeed() }]
				: prev,
		);
	}, []);
	const [pattern, setPattern] = useState<Pattern>("mesh");
	const [shape, setShape] = useState<Shape>("circle");
	const [detail, setDetail] = useState<Detail>(75);
	const [rad, setRad] = useState(25);
	const [output, setOutput] = useState<Output>("layers");
	const [toast, setToast] = useState<string | null>(null);

	const filledSeeds = seeds.map((s) => s.value.trim()).filter(Boolean);
	const count = filledSeeds.length;

	const displaySize = displaySizeForDetail(detail);
	const detailLabel = String(detail);

	function updateSeed(i: number, value: string) {
		setSeeds((prev) => prev.map((s, idx) => (idx === i ? { ...s, value } : s)));
	}
	function removeSeed(i: number) {
		setSeeds((prev) =>
			prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
		);
	}
	function addSeed() {
		if (seeds.length >= MAX_SEEDS) return;
		setFocusIndex(seeds.length);
		setSeeds((prev) => [...prev, { id: nextId(), value: randomSeed() }]);
	}
	function shuffleAll() {
		tapSound();
		setSeeds((prev) => prev.map((s) => ({ ...s, value: randomSeed() })));
	}

	// Corner radius is a percent of the side, so a circle is 50 percent.
	const maxRadius = 50;
	const clampedRadius = Math.min(rad, maxRadius);

	useEffect(() => {
		if (!toast) return;
		const t = window.setTimeout(() => setToast(null), 1600);
		return () => window.clearTimeout(t);
	}, [toast]);

	const showRadius = shape === "rounded";
	const outputHint =
		output === "layers"
			? "Native shapes, editable."
			: `A ${OUTPUT_PX} px PNG, exactly what the web renders.`;
	const insertLabel = count > 1 ? `Insert ${count}` : "Insert";

	function onInsert() {
		if (!count) {
			setToast("Add at least one seed");
			return;
		}
		tapSound();
		setToast(
			`Inserted ${count} ${output === "layers" ? "layered" : "image"} avatar${
				count > 1 ? "s" : ""
			}`,
		);
	}

	return {
		seeds,
		focusIndex,
		pattern,
		setPattern,
		shape,
		setShape,
		detail,
		setDetail,
		displaySize,
		detailLabel,
		rad,
		setRad,
		output,
		setOutput,
		toast,
		count,
		updateSeed,
		removeSeed,
		addSeed,
		shuffleAll,
		maxRadius,
		clampedRadius,
		showRadius,
		outputHint,
		insertLabel,
		onInsert,
	};
}

export type PanelState = ReturnType<typeof usePanelState>;
