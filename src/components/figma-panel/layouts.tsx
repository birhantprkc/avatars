"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { type ComponentType, useEffect, useRef } from "react";
import { radius, type } from "@/lib/design/tokens";
import { useSmoothCorners } from "@/lib/utils/useSmoothCorners";
import {
	AddCard,
	DetailSlider,
	GroupLabel,
	InsertButtons,
	MAX_SEEDS,
	OUTPUT_OPTIONS,
	type PanelState,
	PATTERN_OPTIONS,
	RangeStyle,
	Segmented,
	SeedCard,
	SHAPE_OPTIONS,
	Slider,
	Toast,
	usePanelState,
} from "./shared";

/*
 * Three tidy ways to lay out the same controls. Every token, color, control,
 * and the engine stay the same. Only the control arrangement changes:
 *   1. Stack — one clean column, a thin divider between each group.
 *   2. Cards — each group is an inset panel, so groups read apart.
 *   3. Grid  — Pattern and Output share a row, the sliders run full width.
 *
 * All three sit in the same frame: seeds on the left, controls on the right.
 * Stack is the chosen editor. `FigmaPanelSplitPage` renders it on its own.
 */

type ControlsProps = { p: PanelState };
type ControlsRenderer = ComponentType<ControlsProps>;

/* ── the four control groups, as small pieces each layout can place ── */

function PatternGroup({ p }: ControlsProps) {
	return (
		<>
			<GroupLabel>Pattern</GroupLabel>
			<Segmented
				options={PATTERN_OPTIONS}
				value={p.pattern}
				onChange={p.setPattern}
				label="Render pattern"
			/>
		</>
	);
}

function DetailGroup({ p }: ControlsProps) {
	return (
		<>
			<GroupLabel value={p.detailLabel}>Detail</GroupLabel>
			<DetailSlider value={p.detail} onChange={p.setDetail} />
		</>
	);
}

function ShapeGroup({ p }: ControlsProps) {
	return (
		<>
			<GroupLabel value={p.showRadius ? `${p.clampedRadius}%` : undefined}>
				Shape
			</GroupLabel>
			<Segmented
				options={SHAPE_OPTIONS}
				value={p.shape}
				onChange={p.setShape}
				label="Corner shape"
			/>
			{/* The radius slider only applies to Rounded, so it opens and closes with
			    the shape. Height and opacity run on separate clocks: the height
			    eases open, the slider fades and lifts in just after, and on close
			    it fades out fast so it never looks crushed while it collapses. The
			    -mt-3 cancels the parent gap and the pt-3 puts that gap inside the
			    collapsing box, so the close lands on a true zero with no gap left. */}
			<AnimatePresence initial={false}>
				{p.showRadius && (
					<motion.div
						key="radius"
						initial={{ height: 0, opacity: 0, y: -6 }}
						animate={{
							height: "auto",
							opacity: 1,
							y: 0,
							transition: {
								height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
								opacity: { duration: 0.22, ease: "easeOut", delay: 0.06 },
								y: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
							},
						}}
						exit={{
							height: 0,
							opacity: 0,
							y: -6,
							transition: {
								height: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
								opacity: { duration: 0.12, ease: "easeIn" },
								y: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
							},
						}}
						className="-mt-3 overflow-hidden"
					>
						<div className="pt-3 pb-1">
							<Slider
								value={p.clampedRadius}
								min={0}
								max={p.maxRadius}
								onChange={p.setRad}
								label="Corner radius percent"
							/>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

function OutputGroup({ p }: ControlsProps) {
	return (
		<>
			<GroupLabel>Output</GroupLabel>
			<Segmented
				options={OUTPUT_OPTIONS}
				value={p.output}
				onChange={p.setOutput}
				label="Output kind"
			/>
		</>
	);
}

/* ── 1. Stack: one column, a divider between each group ── */

// A soft staggered reveal for the control groups. The column is the
// orchestrator, so each group drops in just after the one above it. The
// column drives itself on mount, so it plays on the page and in the gallery.
const groupStagger: Variants = {
	hidden: {},
	show: { transition: { delayChildren: 0.25, staggerChildren: 0.07 } },
};
const groupItem: Variants = {
	hidden: { opacity: 0, y: 8 },
	show: {
		opacity: 1,
		y: 0,
		transition: { type: "spring", stiffness: 260, damping: 24 },
	},
};

export function ControlsStack({ p }: ControlsProps) {
	const row = "flex flex-col gap-3 px-3 py-4 first:pt-0 last:pb-0";
	return (
		<motion.div
			variants={groupStagger}
			initial="hidden"
			animate="show"
			className="-mx-3 flex flex-col divide-y divide-white/[0.06]"
		>
			<motion.div variants={groupItem} className={row}>
				<PatternGroup p={p} />
			</motion.div>
			<motion.div variants={groupItem} className={row}>
				<DetailGroup p={p} />
			</motion.div>
			<motion.div variants={groupItem} className={row}>
				<ShapeGroup p={p} />
			</motion.div>
			<motion.div variants={groupItem} className={row}>
				<OutputGroup p={p} />
			</motion.div>
		</motion.div>
	);
}

/* ── 2. Cards: each group on its own inset panel ── */

function ControlsCards({ p }: ControlsProps) {
	const card = "flex flex-col gap-3 rounded-[14px] bg-white/[0.02] p-4";
	return (
		<div className="flex flex-col gap-3">
			<div className={card}>
				<PatternGroup p={p} />
			</div>
			<div className={card}>
				<DetailGroup p={p} />
			</div>
			<div className={card}>
				<ShapeGroup p={p} />
			</div>
			<div className={card}>
				<OutputGroup p={p} />
			</div>
		</div>
	);
}

/* ── 3. Grid: Pattern and Output pair up, sliders run full width ── */

function ControlsGrid({ p }: ControlsProps) {
	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-5">
			<div className="flex flex-col gap-3">
				<PatternGroup p={p} />
			</div>
			<div className="flex flex-col gap-3">
				<GroupLabel>Output</GroupLabel>
				<Segmented
					options={OUTPUT_OPTIONS}
					value={p.output}
					onChange={p.setOutput}
					label="Output kind"
				/>
			</div>
			<div className="col-span-2 flex flex-col gap-3">
				<DetailGroup p={p} />
			</div>
			<div className="col-span-2 flex flex-col gap-3">
				<ShapeGroup p={p} />
			</div>
		</div>
	);
}

/* ── the shared frame: seeds on the left, controls on the right ── */

const SPLIT_PX = 84;

// The seed column is two cards wide. These fixed metrics let the panel stand
// at the height of six cards, so a full 2 by 3 grid shows without a scroll.
const CARD_W = 142; // (320 col - 24 pad - 12 gap) / 2 columns
const CARD_H = Math.round((CARD_W * 8) / 7); // aspect-[7/8], a bit taller
const GRID_GAP = 12; // gap-3
const GRID_PAD = 12; // p-3
const VISIBLE_ROWS = 3; // six seed cards over two columns
const PANEL_H =
	GRID_PAD * 2 + VISIBLE_ROWS * CARD_H + (VISIBLE_ROWS - 1) * GRID_GAP;

export function SplitEditor({
	Controls,
	embedded = false,
	intro = false,
}: {
	Controls: ControlsRenderer;
	embedded?: boolean;
	intro?: boolean;
}) {
	const p = usePanelState();
	// Embedded, the plugin window around it owns the corners. Radius 0 clips
	// the body to a flat rectangle, so it sits flush under the title bar.
	const cardRef = useSmoothCorners<HTMLDivElement>(embedded ? 0 : radius.card);
	const scrollRef = useRef<HTMLDivElement>(null);
	const prevCount = useRef(p.seeds.length);
	const mountedRef = useRef(false);

	// When a new seed adds a row, scroll the column down, so the new card and
	// the add card come into view. We scroll only on growth, not on removal.
	useEffect(() => {
		if (p.seeds.length > prevCount.current) {
			const el = scrollRef.current;
			if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
		}
		prevCount.current = p.seeds.length;
	}, [p.seeds.length]);

	// After the first render, later add-card remounts may play their scale-up.
	useEffect(() => {
		mountedRef.current = true;
	}, []);

	return (
		<div
			ref={cardRef}
			className={`flex w-[640px] bg-white/[0.04] ${
				embedded ? "" : "rounded-[20px]"
			}`}
			style={{ height: PANEL_H }}
		>
			{/* Left: the seed grid. The whole column scrolls once seeds pass six,
			    so the padding scrolls with the cards and no card is cut. On load
			    it slides in from the left, just after the window settles. */}
			<motion.div
				ref={scrollRef}
				initial={intro ? { opacity: 0, x: -14 } : false}
				animate={intro ? { opacity: 1, x: 0 } : false}
				transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.2 }}
				className="h-full w-[320px] shrink-0 overflow-y-auto"
			>
				<div className="grid auto-rows-min grid-cols-2 gap-3 p-3">
					<AnimatePresence initial={false} mode="popLayout">
						{p.seeds.map((seed, i) => (
							<motion.div
								key={seed.id}
								layout
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ type: "spring", stiffness: 500, damping: 40 }}
							>
								<SeedCard
									seed={seed.value}
									index={i}
									pattern={p.pattern}
									shape={p.shape}
									radiusPct={p.clampedRadius}
									displaySize={p.displaySize}
									avatarPx={SPLIT_PX}
									canRemove={p.seeds.length > 1}
									onChange={(v) => p.updateSeed(i, v)}
									onRemove={() => p.removeSeed(i)}
									autoFocus={p.focusIndex === i}
								/>
							</motion.div>
						))}
					</AnimatePresence>
					{/* The add card is outside AnimatePresence and has no layout prop,
					    so it never slides. A key tied to the seed count remounts it in
					    the new cell, where it scales up from small to its full size. */}
					{p.seeds.length < MAX_SEEDS && (
						<motion.div
							key={`add-${p.seeds.length}`}
							initial={
								mountedRef.current ? { opacity: 0, scale: 0.8 } : false
							}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ type: "spring", stiffness: 500, damping: 40 }}
						>
							<AddCard onAdd={p.addSeed} />
						</motion.div>
					)}
				</div>
			</motion.div>

			{/* Right: the controls and the action. */}
			<div className="flex flex-1 flex-col border-l border-white/[0.06]">
				<div className="p-3">
					<Controls p={p} />
				</div>
				<motion.div
					initial={intro ? { opacity: 0, y: 10 } : false}
					animate={intro ? { opacity: 1, y: 0 } : false}
					transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.5 }}
					className="mt-auto border-t border-white/[0.06] p-3"
				>
					<InsertButtons label={p.insertLabel} onInsert={p.onInsert} />
				</motion.div>
			</div>

			<Toast message={p.toast} />
		</div>
	);
}

/* ── the plugin window chrome: the Figma title bar on top of the panel ── */

// The close glyph from the Figma design frame (node 1780:2076). It draws in
// currentColor, so the button can dim it and brighten it on hover.
function CloseGlyph() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M16.224 7.082C16.3203 7.01896 16.4353 6.99097 16.5497 7.00274C16.6642 7.0145 16.7711 7.0653 16.8525 7.1466C16.9339 7.22789 16.9849 7.33474 16.9968 7.44917C17.0087 7.56361 16.9809 7.67866 16.918 7.775L16.853 7.853L12.707 12L16.853 16.146L16.918 16.224C16.9828 16.3202 17.0121 16.4359 17.0009 16.5514C16.9898 16.6668 16.9388 16.7748 16.8568 16.8568C16.7748 16.9388 16.6668 16.9898 16.5514 17.0009C16.4359 17.0121 16.3202 16.9828 16.224 16.918L16.146 16.853L12 12.706L7.853 16.853C7.80688 16.9008 7.7517 16.9388 7.6907 16.9651C7.6297 16.9913 7.56409 17.005 7.4977 17.0056C7.43131 17.0062 7.36547 16.9936 7.30402 16.9684C7.24257 16.9433 7.18675 16.9061 7.1398 16.8592C7.09286 16.8123 7.05573 16.7564 7.03059 16.695C7.00545 16.6335 6.9928 16.5677 6.99337 16.5013C6.99395 16.4349 7.00774 16.3693 7.03395 16.3083C7.06015 16.2473 7.09824 16.1921 7.146 16.146L11.293 11.999L7.146 7.853L7.082 7.775C7.01952 7.67874 6.99199 7.56394 7.004 7.44981C7.01601 7.33568 7.06684 7.22913 7.14798 7.14798C7.22913 7.06684 7.33568 7.01601 7.44981 7.004C7.56394 6.99199 7.67874 7.01952 7.775 7.082L7.853 7.146L12 11.293L16.146 7.146L16.224 7.082Z"
				fill="currentColor"
			/>
		</svg>
	);
}

// The Figma plugin title bar: the app icon, the plugin name, and a close
// button. The fill is #2C2C2C, with a 1px #444 line at the bottom edge.
function PluginTitleBar({ intro = false }: { intro?: boolean }) {
	return (
		<motion.div
			initial={intro ? { opacity: 0, y: -8 } : false}
			animate={intro ? { opacity: 1, y: 0 } : false}
			transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
			className="relative flex h-10 items-center bg-[#2C2C2C] shadow-[inset_0_-1px_0_0_#444]"
		>
			<div className="flex items-center gap-2 pl-4">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src="/figma-plugin-icon.png"
					alt=""
					className="size-4 rounded-[4px] object-cover"
				/>
				<span className="text-[11px] font-[550] leading-4 tracking-[0.055px] text-white">
					Avatars
				</span>
			</div>
			<button
				type="button"
				aria-label="Close"
				className="ml-auto flex size-10 items-center justify-center text-white/55 transition-colors hover:text-white"
			>
				<CloseGlyph />
			</button>
		</motion.div>
	);
}

/* ── the chosen editor, on its own page, dressed as a real plugin ── */

export function FigmaPanelSplitPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#E6E6E6] px-6 py-16">
			<RangeStyle />
			{/* One window: the Figma title bar over the panel body. The window
			    clips both to the same 13px corner, so it looks like the real
			    plugin floating on the Figma canvas. On load it rises and scales
			    up, then hands off to the staggered reveal of its parts. */}
			<motion.div
				initial={{ opacity: 0, y: 16, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 140, damping: 18, mass: 0.9 }}
				className="w-[640px] overflow-hidden rounded-[13px] bg-black shadow-[0_16px_50px_rgba(0,0,0,0.28)]"
			>
				<PluginTitleBar intro />
				<SplitEditor Controls={ControlsStack} embedded intro />
			</motion.div>
		</div>
	);
}

/* ── gallery: all three, stacked, each labelled ── */

const LAYOUTS: { name: string; note: string; Controls: ControlsRenderer }[] = [
	{
		name: "1 · Stack",
		note: "One clean column. A thin divider between each group.",
		Controls: ControlsStack,
	},
	{
		name: "2 · Cards",
		note: "Each group on its own inset panel, so groups read apart.",
		Controls: ControlsCards,
	},
	{
		name: "3 · Grid",
		note: "Pattern and Output pair up. The sliders run full width.",
		Controls: ControlsGrid,
	},
];

export function FigmaPanelLayouts() {
	return (
		<div className="min-h-screen bg-black px-6 py-16">
			<RangeStyle />
			<div className="mx-auto flex max-w-[760px] flex-col items-center gap-16">
				<p style={type.caption} className="leading-4">
					Figma plugin panel · layout options
				</p>
				{LAYOUTS.map(({ name, note, Controls }) => (
					<section
						key={name}
						className="flex w-full flex-col items-center gap-5"
					>
						<div className="flex flex-col items-center gap-1 text-center">
							<span style={type.label} className="leading-5">
								{name}
							</span>
							<span style={type.caption} className="leading-4">
								{note}
							</span>
						</div>
						<SplitEditor Controls={Controls} />
					</section>
				))}
			</div>
		</div>
	);
}
