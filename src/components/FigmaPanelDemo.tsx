"use client";

import { tap as tapSound } from "@outpacelabs/audio";
import { ShuffleIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import {
	type CSSProperties,
	useEffect,
	useLayoutEffect,
	useMemo,
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
/** The hero shows true size up to here, then it stops growing. */
const MAX_PREVIEW = 120;
/** Other seeds, shown small beneath the first one. */
const STRIP_SIZE = 24;
const MAX_STRIP = 7;
/** Blur radius as a fraction of display size, matches the baked-image look. */
const BLUR_FRACTION = 0.06;

const DEFAULT_SEEDS = "jane@example.com\nacme\noutpace";

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
		drawPattern(ctx, seed, resolution, pattern);
	}, [seed, pattern, resolution]);

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

/** Pill toggle, the site's monochrome switch: white track, black knob when on. */
function Toggle({
	checked,
	onChange,
	children,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	children: React.ReactNode;
}) {
	return (
		<label className="flex cursor-pointer items-center justify-between gap-3">
			<span style={type.label} className="leading-5">
				{children}
			</span>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => {
					tapSound();
					onChange(!checked);
				}}
				className={`relative h-[18px] w-[32px] shrink-0 cursor-pointer rounded-full transition-colors ${
					checked ? "bg-white/[0.9]" : "bg-white/[0.12]"
				}`}
			>
				<span
					className={`absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full transition-transform ${
						checked
							? "translate-x-[16px] bg-black"
							: "translate-x-[2px] bg-white/[0.7]"
					}`}
				/>
			</button>
		</label>
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

/* ── panel ── */

export function FigmaPanelDemo() {
	const [seedsText, setSeedsText] = useState(DEFAULT_SEEDS);
	const [pattern, setPattern] = useState<Pattern>("mesh");
	const [shape, setShape] = useState<Shape>("circle");
	const [size, setSize] = useState(96);
	const [rad, setRad] = useState(24);
	const [output, setOutput] = useState<Output>("layers");
	const [usePalette, setUsePalette] = useState(false);
	const [palette, setPalette] = useState("");
	const [seedFromName, setSeedFromName] = useState(true);
	const [toast, setToast] = useState<string | null>(null);

	const cardRef = useSmoothCorners<HTMLDivElement>(radius.card);

	const seeds = useMemo(
		() =>
			seedsText
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.slice(0, MAX_SEEDS),
		[seedsText],
	);

	const maxRadius = Math.floor(size / 2);
	const clampedRadius = Math.min(rad, maxRadius);

	useEffect(() => {
		if (!toast) return;
		const t = window.setTimeout(() => setToast(null), 1600);
		return () => window.clearTimeout(t);
	}, [toast]);

	const showRadius = shape === "rounded" || shape === "squircle";
	const hero = seeds[0];
	const heroPx = Math.min(size, MAX_PREVIEW);
	const outputHint =
		output === "layers"
			? "Native shapes, editable."
			: `A ${pngSize(size)} px PNG, exactly what the web renders.`;
	const insertLabel = seeds.length > 1 ? `Insert ${seeds.length}` : "Insert";

	function onInsert() {
		if (!seeds.length) {
			setToast("Add at least one seed");
			return;
		}
		tapSound();
		setToast(
			`Inserted ${seeds.length} ${output === "layers" ? "layered" : "image"} avatar${
				seeds.length > 1 ? "s" : ""
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
					{/* Preview stage. */}
					<div className="flex flex-col gap-4 p-5">
						<div className="flex items-start justify-between gap-3">
							<span style={type.caption} className="leading-4">
								{pattern}
							</span>
							<span
								style={type.caption}
								className="max-w-[55%] overflow-hidden text-ellipsis whitespace-nowrap leading-4"
							>
								{hero ?? "no seed"}
							</span>
						</div>
						<div className="grid min-h-[132px] place-items-center">
							{hero ? (
								<ShapeAvatar
									seed={hero}
									px={heroPx}
									pattern={pattern}
									shape={shape}
									rad={clampedRadius}
									size={size}
								/>
							) : (
								<span style={type.value}>Add a seed to preview</span>
							)}
						</div>
						{seeds.length > 1 && (
							<div className="flex flex-wrap items-center justify-center gap-1.5">
								{seeds.slice(1, MAX_STRIP + 1).map((seed) => (
									<ShapeAvatar
										key={seed}
										seed={seed}
										px={STRIP_SIZE}
										pattern={pattern}
										shape={shape}
										rad={clampedRadius}
										size={size}
									/>
								))}
							</div>
						)}
					</div>

					{/* Seeds. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel value={seeds.length > 1 ? `${seeds.length}` : undefined}>
							Seeds
						</GroupLabel>
						<div className="flex items-start gap-2">
							<textarea
								value={seedsText}
								onChange={(e) => setSeedsText(e.target.value)}
								rows={3}
								spellCheck={false}
								placeholder="One seed per line"
								aria-label="Seeds"
								style={{ fontFamily: font.mono }}
								className="min-w-0 flex-1 resize-none rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px] leading-[1.6] text-white/[0.88] placeholder:text-white/[0.28] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40"
							/>
							<button
								type="button"
								title="Shuffle seeds"
								aria-label="Shuffle seeds"
								onClick={() => {
									tapSound();
									setSeedsText(
										Array.from(
											{ length: Math.max(1, seeds.length) },
											randomSeed,
										).join("\n"),
									);
								}}
								className="group shrink-0 cursor-pointer rounded-[7px] p-2.5 transition hover:bg-white/[0.08] motion-safe:active:scale-95"
							>
								<span className="block text-white/[0.56] transition-colors group-hover:text-white/[0.88]">
									<ShuffleIcon width={15} height={15} aria-hidden="true" />
								</span>
							</button>
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

					{/* Size. */}
					<div className="flex flex-col gap-3 border-t border-white/[0.06] p-5">
						<GroupLabel value={`${size}px`}>Size</GroupLabel>
						<Slider
							value={size}
							min={16}
							max={512}
							onChange={setSize}
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

					{/* Options. */}
					<div className="flex flex-col gap-4 border-t border-white/[0.06] p-5">
						<Toggle checked={usePalette} onChange={setUsePalette}>
							Brand colors
						</Toggle>
						<input
							type="text"
							value={palette}
							disabled={!usePalette}
							onChange={(e) => setPalette(e.target.value)}
							placeholder="#0F62FE, #FF3D00, #12E29A"
							aria-label="Brand colors"
							style={{ fontFamily: font.mono }}
							className="w-full rounded-[10px] bg-white/[0.06] px-3 py-2 text-[13px] leading-5 text-white/[0.88] transition-opacity placeholder:text-white/[0.28] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 disabled:opacity-40"
						/>
						<Toggle checked={seedFromName} onChange={setSeedFromName}>
							Seed from layer name
						</Toggle>
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
