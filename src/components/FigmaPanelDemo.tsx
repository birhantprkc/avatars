"use client";

import { tap as tapSound } from "@outpacelabs/audio";
import { Plus, Shuffle, X } from "@keyline-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import {
	type CSSProperties,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { drawPattern, type Pattern } from "@/lib/avatars/patterns";
import { font, radius, type } from "@/lib/design/tokens";
import { squirclePath } from "@/lib/utils/squircle";
import { useSmoothCorners } from "@/lib/utils/useSmoothCorners";

/*
 * A Next.js demo of the Figma plugin panel, built on the site's real tokens.
 *
 * The plugin ships a 320 px iframe whose markup lives in
 * `packages/figma-plugin/src/ui`. That panel approximates the site look. This
 * page rebuilds it in the site's own language: one borderless frosted squircle
 * card, pill segmented controls, Inter labels, Geist Mono value readouts, and a
 * single white pill for the primary action. Tune it here, then port it back.
 *
 * The preview renders with the site engine (`drawPattern`), so mesh and dither
 * match the rest of the site. The brand-colors control is UI only here: the
 * site engine takes a harmony, not an explicit palette. The real color wiring
 * stays in the plugin engine.
 */

type Shape = "circle" | "squircle" | "rounded" | "square";
type Output = "layers" | "image";

/** More than this in one insert and a Figma file stops being a pleasure. */
const MAX_SEEDS = 24;
/** Avatar render size inside a seed card, in CSS px. */
const CARD_AVATAR_PX = 84;
/** Blur radius as a fraction of display size, matches the baked-image look. */
const BLUR_FRACTION = 0.06;

const DEFAULT_SEEDS = ["jane@example.com", "acme", "outpace"];

/** Draw resolution for a shown size: above display size so the blur is smooth. */
function resolutionFor(px: number): number {
	return Math.max(128, Math.min(512, Math.round(px * 3)));
}

/** A PNG's real pixel size for the output hint. */
function pngSize(displaySize: number): number {
	return Math.max(256, Math.min(1024, Math.round(displaySize * 2)));
}

function randomSeed(): string {
	return Math.random().toString(36).slice(2, 10);
}

/** Shape styles for a preview box shown at `px`, radius scaled to the size. */
function shapeStyle(
	shape: Shape,
	px: number,
	rad: number,
	size: number,
): CSSProperties {
	const scaled = Math.min(px / 2, rad * (px / size));
	if (shape === "circle") return { borderRadius: "50%" };
	if (shape === "rounded") return { borderRadius: `${scaled}px` };
	if (shape === "squircle") {
		return {
			clipPath: `path("${squirclePath({
				width: px,
				height: px,
				radius: scaled,
				smoothing: radius.smoothing,
			})}")`,
		};
	}
	return { borderRadius: "0" };
}

/** One rendered avatar, cut to the chosen shape. */
function ShapeAvatar({
	seed,
	px,
	pattern,
	shape,
	rad,
	size,
}: {
	seed: string;
	px: number;
	pattern: Pattern;
	shape: Shape;
	rad: number;
	size: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const resolution = resolutionFor(px);

	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, resolution, resolution);
		// Both the hero and the strip preview one avatar: the one inserted at
		// `size`. So the detail follows the chosen output size, not each preview
		// box. Without this the hero and the strip show different complexity.
		drawPattern(ctx, seed, resolution, pattern, { displaySize: size });
	}, [seed, pattern, resolution, size]);

	const blur =
		pattern === "mesh" ? Math.max(1, Math.round(px * BLUR_FRACTION)) : 0;

	return (
		<span
			className="relative block overflow-hidden bg-white/[0.04]"
			style={{ width: px, height: px, ...shapeStyle(shape, px, rad, size) }}
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
		</span>
	);
}

/* ── seed cards, the site's home-grid language ── */

/** One seed as a card: the avatar, plus an editable seed caption below it. */
function SeedCard({
	seed,
	index,
	pattern,
	shape,
	rad,
	size,
	canRemove,
	onChange,
	onRemove,
	autoFocus,
}: {
	seed: string;
	index: number;
	pattern: Pattern;
	shape: Shape;
	rad: number;
	size: number;
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
			className="group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-[16px] bg-white/[0.04] p-3 transition-colors hover:bg-white/[0.06]"
		>
			{canRemove && (
				<button
					type="button"
					title="Remove seed"
					aria-label={`Remove seed ${index + 1}`}
					onClick={() => {
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
				px={CARD_AVATAR_PX}
				pattern={pattern}
				shape={shape}
				rad={rad}
				size={size}
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
				className="w-full min-w-0 rounded-[7px] bg-transparent px-1.5 py-0.5 text-center text-[11px] leading-4 text-white/[0.62] transition-colors placeholder:text-white/[0.28] hover:bg-white/[0.04] focus:bg-white/[0.06] focus:text-white/[0.88] focus:outline-none"
			/>
		</div>
	);
}

/** The empty card. Clicking it adds a seed. */
function AddCard({ onAdd }: { onAdd: () => void }) {
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
			className="group grid aspect-square cursor-pointer place-items-center rounded-[16px] bg-white/[0.02] transition-colors hover:bg-white/[0.05] motion-safe:active:scale-[0.99]"
		>
			<span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/[0.4] transition-colors group-hover:bg-white/[0.1] group-hover:text-white/[0.88]">
				<Plus size={18} aria-hidden="true" />
			</span>
		</button>
	);
}

/* ── controls, all in the site's language ── */

function GroupLabel({
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

function Segmented<T extends string>({
	options,
	value,
	onChange,
	label,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (v: T) => void;
	label: string;
}) {
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
						className={`min-w-0 flex-1 cursor-pointer rounded-full px-2.5 py-1.5 text-[13px] font-[550] leading-5 transition-colors ${
							active
								? "bg-white/[0.14] text-white/[0.92]"
								: "text-white/[0.48] hover:text-white/[0.8]"
						}`}
					>
						{opt.label}
					</button>
				);
			})}
		</fieldset>
	);
}

function Slider({
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

/* ── options ── */

const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
	{ value: "mesh", label: "Mesh" },
	{ value: "dither", label: "Dither" },
];
const SHAPE_OPTIONS: { value: Shape; label: string }[] = [
	{ value: "circle", label: "Circle" },
	{ value: "squircle", label: "Squircle" },
	{ value: "rounded", label: "Rounded" },
	{ value: "square", label: "Square" },
];
const OUTPUT_OPTIONS: { value: Output; label: string }[] = [
	{ value: "layers", label: "Layers" },
	{ value: "image", label: "Image" },
];
/** Four size presets, a clean 2x ramp. The default 96 sits in the middle. */
const SIZE_OPTIONS = [48, 96, 192, 384].map((s) => ({
	value: String(s),
	label: String(s),
}));

/* ── panel ── */

export function FigmaPanelDemo() {
	const [seeds, setSeeds] = useState<string[]>(DEFAULT_SEEDS);
	const [focusIndex, setFocusIndex] = useState<number | null>(null);
	const [pattern, setPattern] = useState<Pattern>("mesh");
	const [shape, setShape] = useState<Shape>("circle");
	const [size, setSize] = useState(96);
	const [rad, setRad] = useState(24);
	const [output, setOutput] = useState<Output>("layers");
	const [toast, setToast] = useState<string | null>(null);

	const cardRef = useSmoothCorners<HTMLDivElement>(radius.card);

	const filledSeeds = seeds.map((s) => s.trim()).filter(Boolean);
	const count = filledSeeds.length;

	function updateSeed(i: number, value: string) {
		setSeeds((prev) => prev.map((s, idx) => (idx === i ? value : s)));
	}
	function removeSeed(i: number) {
		setSeeds((prev) =>
			prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
		);
	}
	function addSeed() {
		if (seeds.length >= MAX_SEEDS) return;
		setFocusIndex(seeds.length);
		setSeeds((prev) => [...prev, randomSeed()]);
	}
	function shuffleAll() {
		tapSound();
		setSeeds((prev) => prev.map(() => randomSeed()));
	}

	const maxRadius = Math.floor(size / 2);
	const clampedRadius = Math.min(rad, maxRadius);

	useEffect(() => {
		if (!toast) return;
		const t = window.setTimeout(() => setToast(null), 1600);
		return () => window.clearTimeout(t);
	}, [toast]);

	const showRadius = shape === "rounded" || shape === "squircle";
	const outputHint =
		output === "layers"
			? "Native shapes, editable."
			: `A ${pngSize(size)} px PNG, exactly what the web renders.`;
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

	return (
		<div className="flex min-h-screen items-start justify-center bg-black px-6 py-16">
			{/* Range skin, same white-on-dark thumb as /create. */}
			<style>{`
.fp-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;outline:none;cursor:pointer}
.fp-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:99px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab}
.fp-range::-webkit-slider-thumb:active{cursor:grabbing}
.fp-range::-moz-range-thumb{width:16px;height:16px;border:none;border-radius:99px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab}
.fp-range:focus-visible{outline:2px solid rgba(255,255,255,0.4);outline-offset:4px}`}</style>

			<div className="flex flex-col items-center gap-5">
				<p style={type.caption} className="leading-4">
					Figma plugin panel
				</p>

				<div
					ref={cardRef}
					className="w-[320px] rounded-[20px] bg-white/[0.04]"
				>
					{/* Seeds, each a card. The empty card adds one. The outer padding
					    and the card gap match, so the grid insets evenly. */}
					<div className="flex flex-col gap-3 p-3">
						<div className="flex items-center justify-between gap-3 px-1 pt-1.5">
							<span style={type.label} className="leading-5">
								Seeds
							</span>
							<div className="flex items-center gap-1">
								<span style={type.value} className="leading-5 tabular-nums">
									{count}
								</span>
								<button
									type="button"
									title="Shuffle all seeds"
									aria-label="Shuffle all seeds"
									onClick={shuffleAll}
									className="group -mr-1 shrink-0 cursor-pointer rounded-[7px] p-1.5 transition hover:bg-white/[0.08] motion-safe:active:scale-95"
								>
									<span className="block text-white/[0.56] transition-colors group-hover:text-white/[0.88]">
										<Shuffle size={14} aria-hidden="true" />
									</span>
								</button>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							{seeds.map((seed, i) => (
								<SeedCard
									// biome-ignore lint/suspicious/noArrayIndexKey: seeds are editable and can repeat, so position is the identity.
									key={i}
									seed={seed}
									index={i}
									pattern={pattern}
									shape={shape}
									rad={clampedRadius}
									size={size}
									canRemove={seeds.length > 1}
									onChange={(v) => updateSeed(i, v)}
									onRemove={() => removeSeed(i)}
									autoFocus={focusIndex === i}
								/>
							))}
							{seeds.length < MAX_SEEDS && <AddCard onAdd={addSeed} />}
						</div>
					</div>

					{/* Pattern. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel>Pattern</GroupLabel>
						<Segmented
							options={PATTERN_OPTIONS}
							value={pattern}
							onChange={setPattern}
							label="Render pattern"
						/>
					</div>

					{/* Size. Four presets as pills, a 2x ramp. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel value={`${size}px`}>Size</GroupLabel>
						<Segmented
							options={SIZE_OPTIONS}
							value={String(size)}
							onChange={(v) => setSize(Number(v))}
							label="Size in pixels"
						/>
					</div>

					{/* Shape / radius. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel value={showRadius ? `${clampedRadius}px` : undefined}>
							Shape
						</GroupLabel>
						<Segmented
							options={SHAPE_OPTIONS}
							value={shape}
							onChange={setShape}
							label="Corner shape"
						/>
						{showRadius && (
							<Slider
								value={clampedRadius}
								min={0}
								max={maxRadius}
								onChange={setRad}
								label="Corner radius in pixels"
							/>
						)}
					</div>

					{/* Output. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel>Output</GroupLabel>
						<Segmented
							options={OUTPUT_OPTIONS}
							value={output}
							onChange={setOutput}
							label="Output kind"
						/>
						<p style={type.value} className="leading-[1.5]">
							{outputHint}
						</p>
					</div>

					{/* Footer actions. */}
					<div className="flex gap-2 border-t border-white/[0.06] p-5">
						<button
							type="button"
							onClick={onInsert}
							className="flex-1 cursor-pointer rounded-full bg-white px-4 py-2.5 text-[13px] font-[550] leading-5 text-black transition hover:bg-white/[0.88] motion-safe:active:scale-[0.99]"
						>
							{insertLabel}
						</button>
						<button
							type="button"
							disabled
							className="flex-1 cursor-not-allowed rounded-full bg-white/[0.06] px-4 py-2.5 text-[13px] font-[550] leading-5 text-white/[0.62] opacity-50"
						>
							Fill selection
						</button>
					</div>
				</div>
			</div>

			{/* On-brand confirmation pill, same language as the site Toast. */}
			<div className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
				<AnimatePresence>
					{toast && (
						<motion.div
							initial={{ opacity: 0, y: 16, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 8 }}
							transition={{ type: "spring", stiffness: 500, damping: 30 }}
							className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/[0.12] px-[14px] py-2 backdrop-blur-[12px]"
						>
							<span className="text-sm font-medium leading-5 tracking-[0.14px] text-white/[0.88]">
								{toast}
							</span>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
