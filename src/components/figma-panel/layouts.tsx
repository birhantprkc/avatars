"use client";

import { AnimatePresence, motion } from "framer-motion";
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

export function ControlsStack({ p }: ControlsProps) {
	const row = "flex flex-col gap-3 px-3 py-4 first:pt-0 last:pb-0";
	return (
		<div className="-mx-3 flex flex-col divide-y divide-white/[0.06]">
			<div className={row}>
				<PatternGroup p={p} />
			</div>
			<div className={row}>
				<DetailGroup p={p} />
			</div>
			<div className={row}>
				<ShapeGroup p={p} />
			</div>
			<div className={row}>
				<OutputGroup p={p} />
			</div>
		</div>
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

export function SplitEditor({ Controls }: { Controls: ControlsRenderer }) {
	const p = usePanelState();
	const cardRef = useSmoothCorners<HTMLDivElement>(radius.card);
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
			className="flex w-[640px] rounded-[20px] bg-white/[0.04]"
			style={{ height: PANEL_H }}
		>
			{/* Left: the seed grid. The whole column scrolls once seeds pass six,
			    so the padding scrolls with the cards and no card is cut. */}
			<div ref={scrollRef} className="h-full w-[320px] shrink-0 overflow-y-auto">
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
			</div>

			{/* Right: the controls and the action. */}
			<div className="flex flex-1 flex-col border-l border-white/[0.06]">
				<div className="p-3">
					<Controls p={p} />
				</div>
				<div className="mt-auto border-t border-white/[0.06] p-3">
					<InsertButtons label={p.insertLabel} onInsert={p.onInsert} />
				</div>
			</div>

			<Toast message={p.toast} />
		</div>
	);
}

/* ── the chosen editor, on its own page ── */

export function FigmaPanelSplitPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
			<RangeStyle />
			<SplitEditor Controls={ControlsStack} />
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
