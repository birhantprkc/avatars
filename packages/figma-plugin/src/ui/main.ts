/**
 * Plugin panel.
 *
 * The iframe is the only half of a Figma plugin with a DOM, so all the
 * drawing happens here: the seed-card previews, the layer plan, and the PNG.
 * The main thread is handed finished work and only makes nodes out of it.
 *
 * The panel wears the site's home-grid language. Seeds are cards on the left,
 * one avatar each. The controls are on the right. Output is a fixed size, so
 * there is no size control: a Detail switch sets the level of detail instead,
 * and the corner radius is a percent of the side.
 */

import { tap } from "@outpacelabs/audio";
import { type Pattern, renderGradient } from "../../../avatars/src/engine.ts";
import type {
	FrameStyle,
	MainMessage,
	Output,
	Selected,
	Settings,
	Shape,
	UiMessage,
} from "../messages.ts";
import { buildPlan } from "../plan.ts";
import { planSeeds, seedForLayer } from "../seeds.ts";

/** More than this in one insert and a Figma file stops being a pleasure. */
const MAX_SEEDS = 24;
/** Every avatar inserts at this pixel size. Detail is separate from it. */
const INSERT_PX = 512;
/** The avatar preview inside one seed card. */
const AVATAR_PX = 84;

/** Detail runs 0 to 100. It maps to an engine display size on a log ramp. */
const DETAIL_MIN = 0;
const DETAIL_MAX = 100;
const DETAIL_STEP = 5;
/** Corner radius is a percent of the side, so a circle is fifty percent. */
const MAX_RADIUS = 50;

/** Turn a 0 to 100 detail into an engine display size, 16 px up to 160 px. */
function displaySizeForDetail(detail: number): number {
	return Math.round(16 * 10 ** (detail / 100));
}

/**
 * The pixel size a preview canvas draws at. The preview is blurred, so a low
 * resolution reads the same as a high one and costs far less to draw. Twice
 * the shown size covers a retina screen; more is wasted work.
 */
const PREVIEW_PX = Math.round(AVATAR_PX * Math.min(2, window.devicePixelRatio || 1));

function randomSeed(): string {
	return Math.random().toString(36).slice(2, 10);
}

/* ── options ── */

// The two pattern glyphs, lifted from the site's PatternSwitch: a round swatch
// with a soft ramp for the mesh, and a checkerboard clipped to a circle for the
// dither. Both draw in currentColor, so they dim and brighten with the label.
const GRADIENT_SVG =
	'<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><defs><linearGradient id="pf-grad" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0.25"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><circle cx="9" cy="9" r="6.5" fill="url(#pf-grad)"/></svg>';
const DITHER_SVG =
	'<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><clipPath id="pf-dither-round"><circle cx="9" cy="9" r="6.5"/></clipPath><g clip-path="url(#pf-dither-round)" fill="currentColor"><rect x="2.5" y="2.5" width="3.55" height="3.55"/><rect x="9" y="2.5" width="3.55" height="3.55"/><rect x="5.75" y="5.75" width="3.55" height="3.55"/><rect x="12.25" y="5.75" width="3.55" height="3.55"/><rect x="2.5" y="9" width="3.55" height="3.55"/><rect x="9" y="9" width="3.55" height="3.55"/><rect x="5.75" y="12.25" width="3.55" height="3.55"/><rect x="12.25" y="12.25" width="3.55" height="3.55"/></g></svg>';

const PATTERN_OPTIONS: { value: Pattern; label: string; icon?: string }[] = [
	{ value: "mesh", label: "Mesh", icon: GRADIENT_SVG },
	{ value: "dither", label: "Dither", icon: DITHER_SVG },
];
const SHAPE_OPTIONS: { value: Shape; label: string }[] = [
	{ value: "circle", label: "Circle" },
	{ value: "rounded", label: "Rounded" },
	{ value: "square", label: "Square" },
];
const OUTPUT_OPTIONS: { value: Output; label: string }[] = [
	{ value: "layers", label: "Layers" },
	{ value: "image", label: "Image" },
];

const PLUS_SVG =
	'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const X_SVG =
	'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/* ── state ── */

/** One seed card. The id keeps its DOM stable across edits. */
interface Card {
	id: string;
	value: string;
}

let idSeq = 0;
const nextId = () => `seed-${idSeq++}`;

const state = {
	seeds: [] as Card[],
	pattern: "mesh" as Pattern,
	shape: "circle" as Shape,
	detail: 75,
	/** Corner radius as a percent of the side. */
	radius: 25,
	output: "layers" as Output,
};

let selection: Selected[] = [];

/* ── elements ── */

const el = <T extends HTMLElement>(id: string) =>
	document.getElementById(id) as T;

const grid = el<HTMLDivElement>("grid");
const detailInput = el<HTMLInputElement>("detail");
const detailValue = el<HTMLSpanElement>("detail-value");
const radiusInput = el<HTMLInputElement>("radius");
const radiusReveal = el<HTMLDivElement>("radius-reveal");
const radiusValue = el<HTMLSpanElement>("radius-value");
const insertButton = el<HTMLButtonElement>("insert");
const fillButton = el<HTMLButtonElement>("fill");

/** The avatar box, canvas, and input of each live card, by seed id. */
const cardEls = new Map<
	string,
	{ box: HTMLDivElement; canvas: HTMLCanvasElement; input: HTMLInputElement }
>();

/* ── talking to the document ── */

function post(message: UiMessage): void {
	parent.postMessage({ pluginMessage: message }, "*");
}

function notify(message: string, error = false): void {
	post({ type: "notify", message, error });
}

function toSettings(): Settings {
	return {
		seeds: state.seeds.map((card) => card.value),
		pattern: state.pattern,
		shape: state.shape,
		detail: state.detail,
		radius: state.radius,
		output: state.output,
	};
}

let saveTimer: number | undefined;
function save(): void {
	window.clearTimeout(saveTimer);
	saveTimer = window.setTimeout(() => {
		post({ type: "save-settings", settings: toSettings() });
	}, 400);
}

/* ── reading the controls ── */

function seedValues(): string[] {
	return state.seeds.map((card) => card.value.trim()).filter(Boolean);
}

/**
 * What one insert would make right now. The selection wins when there is one:
 * six frames selected means six avatars, each seeded from the layer it belongs
 * to. With nothing selected the cards decide, one avatar each.
 */
function insertPlan() {
	return planSeeds({
		typed: seedValues(),
		names: selection.map((node) => node.name),
		max: MAX_SEEDS,
	});
}

function clampedRadius(): number {
	return Math.max(0, Math.min(MAX_RADIUS, state.radius));
}

/* ── preview ── */

/** The corner radius of a preview box shown at `px`, in pixels. */
function boxRadius(px: number): number {
	if (state.shape === "circle") return px / 2;
	if (state.shape === "rounded") return (clampedRadius() / 100) * px;
	return 0;
}

/**
 * Draw the gradient for a seed into its own canvas. Pattern and detail change
 * these pixels; shape and radius do not, so those never call this.
 */
function drawCard(canvas: HTMLCanvasElement, seed: string): void {
	renderGradient(canvas, seed.trim() || " ", {
		pattern: state.pattern,
		displaySize: displaySizeForDetail(state.detail),
	});
}

/** Cut one card box to the chosen shape. This is only a CSS corner radius. */
function shapeCard(box: HTMLDivElement): void {
	box.style.borderRadius = `${boxRadius(AVATAR_PX)}px`;
}

/**
 * Repaint every live card, after a control that changes the pixels. The work
 * is coalesced into the next animation frame, so a fast drag of the Detail
 * slider draws once per frame, not once per input event.
 */
let repaintPending = false;
function repaintAll(): void {
	if (repaintPending) return;
	repaintPending = true;
	requestAnimationFrame(() => {
		repaintPending = false;
		for (const [id, els] of cardEls) {
			const card = state.seeds.find((c) => c.id === id);
			if (card) drawCard(els.canvas, card.value);
		}
	});
}

/** Reshape every live card, after Shape or the radius slider. CSS only, cheap. */
function reshapeAll(): void {
	for (const els of cardEls.values()) shapeCard(els.box);
}

/* ── the seed grid ── */

function makeCard(
	card: Card,
	index: number,
	existing?: HTMLCanvasElement,
): HTMLDivElement {
	const root = document.createElement("div");
	root.className = "card";
	// A stable key, so a rebuild can slide this card from its old cell to its
	// new one (see flip). The add button carries the key "add".
	root.dataset.flipKey = card.id;

	const box = document.createElement("div");
	box.className = "avatar";
	shapeCard(box);

	// A grid rebuild only adds or removes a seed. The pixels of the seeds that
	// stay are the same, so reuse their canvas and do not draw it again. Only a
	// brand new seed renders here, so one heavy mesh draw never blocks the pop
	// animation of the whole grid.
	const canvas = existing ?? document.createElement("canvas");
	if (!existing) {
		canvas.width = PREVIEW_PX;
		canvas.height = PREVIEW_PX;
	}
	box.append(canvas);

	const input = document.createElement("input");
	input.value = card.value;
	input.spellcheck = false;
	input.autocomplete = "off";
	input.placeholder = "seed";
	input.setAttribute("aria-label", `Seed ${index + 1}`);
	input.addEventListener("click", (event) => event.stopPropagation());
	input.addEventListener("input", () => {
		card.value = input.value;
		drawCard(canvas, card.value);
		syncControls();
		save();
	});

	root.addEventListener("click", () => input.focus());

	if (state.seeds.length > 1) {
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "remove";
		remove.title = "Remove seed";
		remove.setAttribute("aria-label", `Remove seed ${index + 1}`);
		remove.innerHTML = X_SVG;
		remove.addEventListener("click", (event) => {
			event.stopPropagation();
			removeSeed(card.id);
		});
		root.append(remove);
	}

	root.append(box, input);
	cardEls.set(card.id, { box, canvas, input });
	if (!existing) drawCard(canvas, card.value);
	return root;
}

function buildGrid(): void {
	// Keep the canvases of the current cards, so a rebuild can hand each seed
	// back its own already drawn canvas instead of drawing every card again.
	const prev = new Map(cardEls);
	cardEls.clear();
	grid.replaceChildren();
	state.seeds.forEach((card, index) =>
		grid.append(makeCard(card, index, prev.get(card.id)?.canvas)),
	);

	if (state.seeds.length < MAX_SEEDS) {
		const add = document.createElement("button");
		add.type = "button";
		add.className = "add";
		add.title = "Add seed";
		add.setAttribute("aria-label", "Add seed");
		add.dataset.flipKey = "add";
		add.innerHTML = PLUS_SVG;
		add.addEventListener("click", addSeed);
		grid.append(add);
	}
}

/**
 * Slide the grid smoothly across a rebuild. It reads every cell position, runs
 * the change, then reads the new positions. Each cell that moved starts at its
 * old spot and eases to the new one, so the plus card and its neighbors flow
 * into the gap a removed card leaves, rather than jumping.
 */
function flip(mutate: () => void): void {
	const before = new Map<string, DOMRect>();
	for (const child of Array.from(grid.children) as HTMLElement[]) {
		const key = child.dataset.flipKey;
		if (key) before.set(key, child.getBoundingClientRect());
	}

	mutate();

	for (const child of Array.from(grid.children) as HTMLElement[]) {
		const key = child.dataset.flipKey;
		const prev = key ? before.get(key) : undefined;
		if (!prev) continue; // a brand new cell has no old spot; it does not slide
		const now = child.getBoundingClientRect();
		const dx = prev.left - now.left;
		const dy = prev.top - now.top;
		if (!dx && !dy) continue;

		child.style.transition = "none";
		child.style.transform = `translate(${dx}px, ${dy}px)`;
		requestAnimationFrame(() => {
			child.style.transition = "transform 0.32s var(--spring)";
			child.style.transform = "";
			child.addEventListener(
				"transitionend",
				() => {
					child.style.transition = "";
					child.style.transform = "";
				},
				{ once: true },
			);
		});
	}
}

function addSeed(): void {
	if (state.seeds.length >= MAX_SEEDS) return;
	tap();
	const card = { id: nextId(), value: randomSeed() };
	state.seeds.push(card);
	buildGrid();
	const els = cardEls.get(card.id);
	els?.input.focus();
	els?.input.select();
	// Pop the new card in, and the add card that slid into the next cell.
	els?.input.closest(".card")?.classList.add("pop");
	grid.querySelector(".add")?.classList.add("pop");
	// Scroll the seed column down, so a new card past the sixth comes into
	// view. The web demo does the same on every seed the grid grows by.
	const scroller = grid.parentElement;
	if (scroller)
		scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
	syncControls();
	save();
}

function removeSeed(id: string): void {
	if (state.seeds.length <= 1) return;
	tap();

	const drop = () => {
		state.seeds = state.seeds.filter((card) => card.id !== id);
		// Slide the surviving cards and the plus card into the gap, rather than
		// letting the rebuild snap them to new cells.
		flip(buildGrid);
		syncControls();
		save();
	};

	// Play the create pop in reverse on the card, then drop it once the
	// animation ends. A timeout backs the event up, so a card never stays if
	// the animation does not fire.
	const cardEl = cardEls.get(id)?.input.closest<HTMLElement>(".card");
	if (!cardEl) {
		drop();
		return;
	}
	let done = false;
	const finish = () => {
		if (done) return;
		done = true;
		drop();
	};
	cardEl.classList.add("pop-out");
	cardEl.addEventListener("animationend", finish, { once: true });
	window.setTimeout(finish, 400);
}

/* ── segmented controls, with a sliding pill ── */

function segmented<T extends string>(
	id: string,
	options: { value: T; label: string; icon?: string }[],
	set: (value: T) => void,
): void {
	const host = el<HTMLDivElement>(id);
	host.replaceChildren();

	const pill = document.createElement("span");
	pill.className = "pill";
	host.append(pill);

	for (const option of options) {
		const button = document.createElement("button");
		button.type = "button";
		if (option.icon) {
			const glyph = document.createElement("span");
			glyph.className = "seg-icon";
			glyph.innerHTML = option.icon;
			button.append(glyph, document.createTextNode(option.label));
		} else {
			button.textContent = option.label;
		}
		button.dataset.value = option.value;
		button.addEventListener("click", () => {
			if (button.getAttribute("aria-pressed") === "true") return;
			set(option.value);
		});
		host.append(button);
	}
}

function syncSegmented(id: string, value: string): void {
	const host = el<HTMLDivElement>(id);
	let active: HTMLButtonElement | undefined;
	for (const button of Array.from(host.querySelectorAll("button"))) {
		const on = button.dataset.value === value;
		button.setAttribute("aria-pressed", on ? "true" : "false");
		if (on) active = button;
	}
	const pill = host.querySelector<HTMLSpanElement>(".pill");
	if (active && pill) {
		pill.style.width = `${active.offsetWidth}px`;
		pill.style.transform = `translateX(${active.offsetLeft}px)`;
	}
}

/* ── sliders ── */

function fillTrack(
	input: HTMLInputElement,
	min: number,
	max: number,
	value: number,
): void {
	const pct = ((value - min) / (max - min)) * 100;
	input.style.background = `linear-gradient(to right, rgba(255,255,255,0.72) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
}

/* ── push the whole of `state` back to the panel ── */

function syncControls(): void {
	syncSegmented("pattern", state.pattern);
	syncSegmented("shape", state.shape);
	syncSegmented("output", state.output);

	detailInput.value = String(state.detail);
	detailValue.textContent = String(state.detail);
	fillTrack(detailInput, DETAIL_MIN, DETAIL_MAX, state.detail);

	const rounded = state.shape === "rounded";
	const cr = clampedRadius();
	radiusReveal.classList.toggle("open", rounded);
	radiusValue.textContent = rounded ? `${cr}%` : "";
	radiusInput.value = String(cr);
	fillTrack(radiusInput, 0, MAX_RADIUS, cr);

	const plan = insertPlan();

	fillButton.disabled = selection.length === 0;
	fillButton.textContent = selection.length
		? `Fill ${selection.length} selected`
		: "Fill selection";
	insertButton.textContent =
		plan.seeds.length > 1 ? `Insert ${plan.seeds.length}` : "Insert";
}

/* ── the two ways out ── */

function frameStyle(): FrameStyle {
	return {
		shape: state.shape,
		radius: Math.round((clampedRadius() / 100) * INSERT_PX),
		smoothing: 0,
	};
}

async function renderPng(
	seed: string,
	resolution: number,
	displaySize: number,
): Promise<Uint8Array> {
	const canvas = document.createElement("canvas");
	canvas.width = resolution;
	canvas.height = resolution;
	renderGradient(canvas, seed, { pattern: state.pattern, displaySize });
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (!blob) throw new Error("The avatar could not be rendered");
	return new Uint8Array(await blob.arrayBuffer());
}

async function insert(): Promise<void> {
	const list = insertPlan().seeds;
	if (!list.length) {
		notify("Add at least one seed, or select a layer", true);
		return;
	}
	tap();
	const displaySize = displaySizeForDetail(state.detail);

	if (state.output === "layers") {
		post({
			type: "insert-layers",
			frame: frameStyle(),
			avatars: list.map((seed) => {
				const plan = buildPlan({
					seed,
					pattern: state.pattern,
					size: INSERT_PX,
					displaySize,
				});
				return { seed, size: plan.size, blur: plan.blur, ops: plan.ops };
			}),
		});
		return;
	}

	const resolution = Math.max(256, Math.min(1024, INSERT_PX * 2));
	const avatars = [];
	for (const seed of list) {
		avatars.push({
			seed,
			size: INSERT_PX,
			bytes: await renderPng(seed, resolution, displaySize),
		});
	}
	post({ type: "insert-images", frame: frameStyle(), avatars });
}

/**
 * Fill what the user selected. An avatar goes into any shape here, whatever
 * its geometry, so this path is always an image. The seed is the layer's own
 * name, the same rule Insert follows. Unlike Insert it is not capped: the
 * layers already exist, so filling them adds nothing to the file.
 */
async function fillSelection(): Promise<void> {
	tap();
	const list = seedValues();
	const displaySize = displaySizeForDetail(state.detail);
	const items = [];
	for (let i = 0; i < selection.length; i++) {
		const node = selection[i];
		const seed = seedForLayer(node.name, list, i);
		const resolution = Math.max(256, Math.min(1024, Math.round(node.width * 2)));
		items.push({ id: node.id, bytes: await renderPng(seed, resolution, displaySize) });
	}
	post({ type: "fill-selection", items });
}

/* ── wiring ── */

segmented<Pattern>("pattern", PATTERN_OPTIONS, (value) => {
	tap();
	state.pattern = value;
	repaintAll();
	syncControls();
	save();
});

segmented<Shape>("shape", SHAPE_OPTIONS, (value) => {
	tap();
	state.shape = value;
	// Shape is a corner radius, not a pixel. Reshape the boxes, do not redraw.
	reshapeAll();
	syncControls();
	save();
});

segmented<Output>("output", OUTPUT_OPTIONS, (value) => {
	tap();
	state.output = value;
	syncControls();
	save();
});

detailInput.min = String(DETAIL_MIN);
detailInput.max = String(DETAIL_MAX);
detailInput.step = String(DETAIL_STEP);
detailInput.addEventListener("input", () => {
	const value = Number(detailInput.value);
	if (value === state.detail) return;
	tap();
	state.detail = value;
	repaintAll();
	syncControls();
	save();
});

radiusInput.min = "0";
radiusInput.max = String(MAX_RADIUS);
radiusInput.step = "1";
radiusInput.addEventListener("input", () => {
	state.radius = Number(radiusInput.value);
	// The radius only moves the corner. Reshape the boxes, do not redraw them.
	reshapeAll();
	syncControls();
	save();
});

const run = (job: () => Promise<void>) => () => {
	job().catch((error: unknown) => {
		notify(error instanceof Error ? error.message : String(error), true);
	});
};

insertButton.addEventListener("click", run(insert));
fillButton.addEventListener("click", run(fillSelection));

/* ── loading and the selection ── */

function loadSettings(saved: Settings): void {
	const raw = Array.isArray(saved.seeds)
		? saved.seeds
		: typeof saved.seeds === "string"
			? (saved.seeds as string).split("\n")
			: [];
	const values = raw.map((value) => String(value).trim()).filter(Boolean);
	state.seeds = (values.length ? values : [randomSeed()]).map((value) => ({
		id: nextId(),
		value,
	}));

	if (saved.pattern) state.pattern = saved.pattern;
	// An older file may hold a shape this panel no longer offers.
	if (saved.shape) {
		state.shape = saved.shape === "squircle" ? "rounded" : saved.shape;
	}
	if (typeof saved.detail === "number") state.detail = saved.detail;
	if (typeof saved.radius === "number") {
		state.radius = Math.max(0, Math.min(MAX_RADIUS, saved.radius));
	}
	if (saved.output) state.output = saved.output;
}

function ensureSeed(): void {
	if (!state.seeds.length) {
		state.seeds = [{ id: nextId(), value: randomSeed() }];
	}
}

window.addEventListener("message", (event: MessageEvent) => {
	const message = event.data?.pluginMessage as MainMessage | undefined;
	if (!message) return;
	if (message.type === "init") {
		if (message.settings) loadSettings(message.settings);
		ensureSeed();
		selection = message.selection;
		buildGrid();
		syncControls();
		return;
	}
	if (message.type === "selection") {
		selection = message.selection;
		syncControls();
	}
});

ensureSeed();
buildGrid();
syncControls();
