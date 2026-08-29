"use client";

import {
	confirm as confirmSound,
	copy as copySound,
	deny as denySound,
	tap as tapSound,
} from "@outpacelabs/audio";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { IconButton } from "@/components/IconButton";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast } from "@/components/Toast";
import {
	clipboardSupported,
	copyAvatar,
	downloadAvatar,
} from "@/lib/avatars/export";
import { generatePalette, toSeed } from "@/lib/avatars/mesh-gradient";

/*
 * /demo, a true 3D orbital ring of avatars (react-three-fiber / WebGL).
 *
 * Each avatar is a lit sphere placed on a circle in the XZ plane. A perspective
 * camera looks in from slightly above, so the front of the ring is genuinely
 * nearer/larger and the back recedes into fog, the spheres actually pass in
 * front of and behind each other. Drag/swipe, scroll (either trackpad axis), or
 * ←/→ spins the ring; it settles on the nearest avatar. The front-center avatar
 * is the selection; it can be copied/downloaded. Every seed is unique and orbs
 * reseed as they hide in the back, so the ring never repeats. Responsive: the
 * fov widens on portrait and the render budget drops on touch devices.
 */

const MONO =
	"var(--font-geist-mono), ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

/** A session-unique seed, using the same base36 token format as the home grid
 *  (`Math.random().toString(36).slice(2, 10)`), so the ring never repeats. */
const usedSeeds = new Set<string>();
function makeSeed(): string {
	let s = Math.random().toString(36).slice(2, 10);
	while (usedSeeds.has(s)) s = Math.random().toString(36).slice(2, 10);
	usedSeeds.add(s);
	return s;
}

/** Number of orbs on the ring. */
const POOL = 14;
const STEP = (Math.PI * 2) / POOL;
/** Stable React keys for the fixed orb slots (seeds change; slots don't). */
const SLOT_KEYS = Array.from({ length: POOL }, (_, i) => `orb-slot-${i}`);

/** Ring radius, disc radius (world units) and scroll sensitivity. */
const RING_R = 6.2;
const DISC_R = 0.5;
/**
 * Lift the whole ring in world-Y. The camera looks down from y=3, so the front
 * orb (at world y=0) projects ~23% below screen centre, it reads as sinking to
 * the bottom. The camera's view axis passes through ~y=0.85 at the front orb's
 * depth; lifting a touch past that optically centres the orb with room beneath
 * for the seed label.
 */
const RING_Y = 1.0;
const SENSITIVITY = 0.0034;
/** Idle drift, radians per second, a slow continuous orbit. */
const AUTO_SPEED = 0.09;
/** Extra scale for the front of the ring, so the center orb reads bigger. */
const FRONT_BOOST = 0.7;
/** Drag/swipe sensitivity for spinning the whole ring, radians per pixel. */
const DRAG_SENS = 0.006;
/** Drag sensitivity for spinning an individual orb, radians per pixel. */
const ORB_ROT_SENS = 0.008;
/** Gap (px) between the front orb's on-screen bottom and the seed label. */
const LABEL_GAP = 52;
/** Sphere tessellation, enough to read round at this size, light for mobile. */
const SPHERE_SEGS: [number, number] = [48, 32];

const spinDelta = new THREE.Quaternion();
// Scratch vectors for projecting the front orb to screen space (to anchor the
// seed label just below it).
const _projMid = new THREE.Vector3();
const _projTop = new THREE.Vector3();

function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s += 0x6d2b79f5;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A uniform-random unit vector, deterministic per seed. */
function randomAxis(seed: number): THREE.Vector3 {
	const r = rng(seed);
	const z = 2 * r() - 1;
	const a = 2 * Math.PI * r();
	const s = Math.sqrt(Math.max(0, 1 - z * z));
	return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z);
}

/** Dither cells per cube face (face spans 90°, so ~4·CELLS around the orb). */
const CUBE_CELLS = 48;

/*
 * Gradient mode: the orb colour is generated procedurally in 3D, coloured
 * "spots" placed as directions on the sphere, blended by the surface normal.
 * A function of the object-space normal has no texture, so no seam.
 *
 * Dither mode: the dithered rendering of the SAME field, on a QUAD-SPHERE cell
 * grid (the planet-renderer trick). The normal is projected onto its dominant
 * cube face, warped equal-angle so cells stay evenly sized, snapped to the
 * cell grid, and unprojected back to the cell centre's direction; the field is
 * evaluated there and an ordered 8×8 Bayer picks between its two nearest
 * palette colours. A sphere cannot carry a perfectly regular square grid
 * (Euler characteristic), but this hides the unavoidable defects in 8 tiny
 * cube corners and 12 orientation edges instead of 2 catastrophic poles,
 * no swirls, no convergence, cells glued to the surface, and the projection
 * and its inverse share one axis table so the two can never disagree.
 */
const ORB_COMMON = `
varying vec3 vObjN;
uniform vec3 uBase;
uniform vec3 uSpotDir[8];
uniform vec3 uSpotCol[8];
uniform float uSpotSharp[8];
uniform int uSpotCount;
uniform float uDither;
uniform vec3 uPal[4];
uniform int uPalCount;
vec3 orbField(vec3 n){
	vec3 col = uBase;
	for (int k = 0; k < 8; k++){
		if (k >= uSpotCount) break;
		float w = smoothstep(uSpotSharp[k], 1.0, dot(n, uSpotDir[k]));
		col = mix(col, uSpotCol[k], w);
	}
	return col;
}
float orbB2(vec2 p){ return 2.0 * p.x + 3.0 * p.y - 4.0 * p.x * p.y; }
float orbBayer(vec2 c){
	vec2 p = mod(c, 8.0);
	vec2 b0 = mod(p, 2.0);
	vec2 b1 = mod(floor(p * 0.5), 2.0);
	vec2 b2 = mod(floor(p * 0.25), 2.0);
	return (16.0 * orbB2(b2) + 4.0 * orbB2(b1) + orbB2(b0) + 0.5) / 64.0;
}
// One axis table for the cube projection AND its inverse.
void orbFaceAxes(vec3 n, out vec3 A, out vec3 T, out vec3 B){
	vec3 an = abs(n);
	if (an.x >= an.y && an.x >= an.z) {
		A = vec3(sign(n.x), 0.0, 0.0); T = vec3(0.0, 0.0, -sign(n.x)); B = vec3(0.0, 1.0, 0.0);
	} else if (an.y >= an.z) {
		A = vec3(0.0, sign(n.y), 0.0); T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 0.0, sign(n.y));
	} else {
		A = vec3(0.0, 0.0, sign(n.z)); T = vec3(sign(n.z), 0.0, 0.0); B = vec3(0.0, 1.0, 0.0);
	}
}
vec3 orbDither(vec3 n){
	vec3 A; vec3 T; vec3 B;
	orbFaceAxes(n, A, T, B);
	float d = dot(n, A);
	// Gnomonic face coords in [-1,1], warped equal-angle for even cell size.
	vec2 g = vec2(dot(n, T), dot(n, B)) / max(d, 1e-5);
	vec2 w = atan(g) * (4.0 / ${Math.PI.toFixed(8)});
	// Snap to the cell grid; unwarp the CELL CENTRE back to a direction.
	vec2 cell = floor(clamp(w * 0.5 + 0.5, 0.0, 0.9999) * ${CUBE_CELLS.toFixed(1)});
	vec2 cw = ((cell + 0.5) / ${CUBE_CELLS.toFixed(1)}) * 2.0 - 1.0;
	vec2 cg = tan(cw * ${(Math.PI / 4).toFixed(8)});
	vec3 cd = normalize(A + cg.x * T + cg.y * B);
	// drawDither()'s pick at the cell centre: the two nearest palette colours,
	// ordered Bayer chooses between them. Solid in blobs, checkered at blends.
	vec3 f = orbField(cd);
	int i0 = 0; int i1 = 0;
	float d0 = 1e9; float d1 = 1e9;
	for (int k = 0; k < 4; k++){
		if (k >= uPalCount) break;
		float dd = distance(f, uPal[k]);
		if (dd < d0) { d1 = d0; i1 = i0; d0 = dd; i0 = k; }
		else if (dd < d1) { d1 = dd; i1 = k; }
	}
	// Order the pair by palette index (like the 2D dither's fixed adjacent
	// stops) so t spans the FULL 0..1 across a blend. Two-nearest alone flips
	// sides at the midpoint, so t never passed 0.5, half the Bayer range
	// never fired and the dots clumped instead of grading smoothly.
	vec3 a = uPal[i0 < i1 ? i0 : i1];
	vec3 b = uPal[i0 < i1 ? i1 : i0];
	vec3 e = b - a;
	float t = clamp(dot(f - a, e) / max(dot(e, e), 1e-4), 0.0, 1.0);
	return t > orbBayer(cell) ? b : a;
}
`;

/* ── the shared orb field ──
 * Both render modes show the SAME orb: a set of coloured "spots" placed as 3D
 * directions on the sphere, blended by the surface normal. Gradient mode
 * renders it smoothly; dither mode renders it as ordered dither. A multi-blob
 * field has no global axis, so neither mode can read as a flat 2D ramp pasted
 * on the sphere. */

interface OrbField {
	colors: string[];
	count: number;
	dirs: THREE.Vector3[];
	colIdx: number[];
	sharp: number[];
}

function makeOrbField(s: number): OrbField {
	const { colors } = generatePalette(s);
	const r = rng((s ^ 0x1234abcd) >>> 0);
	const count = 5 + Math.floor(r() * 3); // 5–7 colour spots
	const dirs: THREE.Vector3[] = [];
	const colIdx: number[] = [];
	const sharp: number[] = [];
	for (let i = 0; i < count; i++) {
		const z = 2 * r() - 1;
		const a = 2 * Math.PI * r();
		const ss = Math.sqrt(Math.max(0, 1 - z * z));
		dirs.push(new THREE.Vector3(ss * Math.cos(a), ss * Math.sin(a), z));
		colIdx.push(i % colors.length);
		sharp.push(-0.3 + r() * 0.65); // soft, broad blobs
	}
	return { colors, count, dirs, colIdx, sharp };
}

/** MeshStandardMaterial for a seed: the seamless procedural gradient field,
 *  with a quad-sphere ordered-dither rendering of the same field toggled by
 *  the `uDither` uniform in userData. Fully procedural, no textures. */
function makeOrbMaterial(seed: string): THREE.MeshStandardMaterial {
	const s = toSeed(seed);
	// The same field in both modes, the dither is a rendering style, not a
	// different orb.
	const field = makeOrbField(s);
	const rgb = field.colors.map((h) => new THREE.Color(h));
	const count = field.count;
	const dirs = field.dirs.map((d) => d.clone());
	const cols = field.colIdx.map((i) => rgb[i].clone());
	const sharp = [...field.sharp];
	while (dirs.length < 8) {
		dirs.push(new THREE.Vector3(0, 1, 0));
		cols.push(new THREE.Color(0, 0, 0));
		sharp.push(1.1);
	}
	const pal = rgb.slice(0, 4).map((c) => c.clone());
	const palCount = Math.min(rgb.length, 4);
	while (pal.length < 4) pal.push(new THREE.Color(0, 0, 0));

	const uDither = { value: 0 };
	const mat = new THREE.MeshStandardMaterial({
		emissive: new THREE.Color(0xffffff),
		emissiveIntensity: 0.7,
		roughness: 0.5,
		metalness: 0,
	});
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uBase = { value: rgb[0].clone() };
		shader.uniforms.uSpotDir = { value: dirs };
		shader.uniforms.uSpotCol = { value: cols };
		shader.uniforms.uSpotSharp = { value: sharp };
		shader.uniforms.uSpotCount = { value: count };
		shader.uniforms.uDither = uDither;
		shader.uniforms.uPal = { value: pal };
		shader.uniforms.uPalCount = { value: palCount };
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nvarying vec3 vObjN;")
			.replace(
				"#include <beginnormal_vertex>",
				"#include <beginnormal_vertex>\nvObjN = normal;",
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				`#include <common>\n${ORB_COMMON}\nvec3 vOrb;`,
			)
			.replace(
				"#include <map_fragment>",
				`vOrb = uDither > 0.5
					? orbDither(normalize(vObjN))
					: orbField(normalize(vObjN));
				diffuseColor.rgb *= vOrb;`,
			)
			.replace(
				"#include <emissivemap_fragment>",
				"totalEmissiveRadiance *= vOrb;",
			);
	};
	mat.userData.uDither = uDither;
	return mat;
}

const DownloadIcon = () => (
	<svg
		aria-hidden="true"
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M13.5 9.83333V13.5H2.5V9.83333M7.99999 2.5L8 9.33333M5.66667 7.66667L7.99999 10L10.3333 7.66667"
			stroke="currentColor"
			strokeWidth="1.25"
			strokeLinecap="square"
		/>
	</svg>
);

const ClipboardIcon = () => (
	<svg
		aria-hidden="true"
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M10.1667 3.16634H12.8334V14.1663H3.16675V3.16634H5.83341M5.83341 1.83301H10.1667V4.83301H5.83341V1.83301Z"
			stroke="currentColor"
			strokeWidth="1.25"
			strokeLinecap="square"
		/>
	</svg>
);

const GLYPHS =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@/._-";

/**
 * The selected seed, "decoded" into place whenever it changes: each glyph
 * cycles random characters then locks to its target, staggered left-to-right,
 * the same effect the docs' install command uses. First mount and reduced
 * motion render the text plainly.
 */
function ScrambleText({ text, reduced }: { text: string; reduced: boolean }) {
	const [scramble, setScramble] = useState<string | null>(null);
	const mounted = useRef(false);

	useEffect(() => {
		if (!mounted.current) {
			mounted.current = true;
			return;
		}
		if (reduced) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setScramble(null);
			return;
		}
		const chars = [...text];
		const PER = 6; // ms of stagger per character
		const DUR = 130; // ms each character spends scrambling
		const start = performance.now();
		let raf = 0;
		const tick = (now: number) => {
			const elapsed = now - start;
			let settled = true;
			const frame = chars.map((ch, i) => {
				if (ch === " " || elapsed >= i * PER + DUR) return ch;
				settled = false;
				return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
			});
			setScramble(settled ? null : frame.join(""));
			if (!settled) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [text, reduced]);

	return <>{scramble ?? text}</>;
}

/** One orb: its seed, material, and per-orb tumble (all derived from the seed
 *  so every orb looks and moves its own way). */
interface Orb {
	seed: string;
	mat: THREE.MeshStandardMaterial;
	spin: THREE.Quaternion;
	axis: THREE.Vector3;
	speed: number;
}

function makeOrb(seed: string): Orb {
	const s = toSeed(seed);
	const r0 = rng((s ^ 0x0be11) >>> 0);
	const spin = new THREE.Quaternion().setFromAxisAngle(
		randomAxis((s ^ 0x7a11) >>> 0),
		r0() * Math.PI * 2,
	);
	const axis = randomAxis((s ^ 0x51ed) >>> 0);
	const rs = rng((s ^ 0x9a37) >>> 0);
	const speed = (0.12 + rs() * 0.34) * (rs() < 0.5 ? -1 : 1);
	return { seed, mat: makeOrbMaterial(seed), spin, axis, speed };
}

function Ring({
	targetRef,
	draggingRef,
	reduced,
	onSelect,
	labelRef,
}: {
	targetRef: React.RefObject<number>;
	/** True while the user is dragging/swiping the ring, pauses the idle drift. */
	draggingRef: React.RefObject<boolean>;
	reduced: boolean;
	onSelect: (seed: string) => void;
	/** The seed-label/controls overlay; its `top` tracks the front orb's base. */
	labelRef: React.RefObject<HTMLDivElement | null>;
}) {
	const meshes = useRef<(THREE.Mesh | null)[]>([]);
	const curRef = useRef(0);
	const lastSel = useRef(-1);
	const { camera, size } = useThree();

	// Each orb owns a unique seed + material. As an orb swings to the back of
	// the ring (hidden in the fog) it's reseeded with a fresh unique seed, so
	// the ring never shows the same avatar twice.
	const orbs = useRef<Orb[]>([]);
	if (orbs.current.length === 0) {
		orbs.current = Array.from({ length: POOL }, () => makeOrb(makeSeed()));
	}
	// Reseed once per trip to the back: armed at the front, fired at the back.
	const armed = useRef<boolean[]>(Array.from({ length: POOL }, () => false));

	const geometry = useMemo(
		() => new THREE.SphereGeometry(DISC_R, SPHERE_SEGS[0], SPHERE_SEGS[1]),
		[],
	);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(
		() => () => {
			for (const o of orbs.current) o.mat.dispose();
		},
		[],
	);

	// Grab an orb to spin it in place. The mesh's raycast pointer-down (below)
	// records which orb; dragging composes onto that orb's own quaternion. The
	// down event also stops propagating, so grabbing an orb never starts a
	// ring-spin.
	const orbDrag = useRef<{ i: number; x: number; y: number } | null>(null);
	useEffect(() => {
		const dq = new THREE.Quaternion();
		const euler = new THREE.Euler();
		const onMove = (e: PointerEvent) => {
			const d = orbDrag.current;
			if (!d) return;
			const dx = e.clientX - d.x;
			const dy = e.clientY - d.y;
			d.x = e.clientX;
			d.y = e.clientY;
			// Apply the drag in the camera frame (premultiply) so the axes stay
			// screen-aligned however the orb is already turned.
			euler.set(dy * ORB_ROT_SENS, dx * ORB_ROT_SENS, 0);
			orbs.current[d.i].spin.premultiply(dq.setFromEuler(euler));
		};
		const onUp = () => {
			orbDrag.current = null;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, []);

	useFrame((_, delta) => {
		// Slow idle orbit (paused while the user drags the ring or an orb); scroll
		// and swipe add on top.
		if (!reduced && !draggingRef.current && !orbDrag.current)
			targetRef.current += AUTO_SPEED * delta;
		const target = targetRef.current;
		curRef.current += (target - curRef.current) * (reduced ? 1 : 0.16);
		const rot = curRef.current;

		for (let i = 0; i < POOL; i++) {
			const mesh = meshes.current[i];
			if (!mesh) continue;
			let orb = orbs.current[i];
			if (mesh.material !== orb.mat) mesh.material = orb.mat;

			const a = i * STEP + rot;
			const cosA = Math.cos(a);
			mesh.position.set(Math.sin(a) * RING_R, RING_Y, cosA * RING_R);

			// Arm at the front; once it's hidden at the back, retire this orb and
			// mint a brand-new unique one in its place (never the grabbed one).
			if (cosA > 0.5) armed.current[i] = true;
			else if (cosA < -0.5 && armed.current[i] && orbDrag.current?.i !== i) {
				armed.current[i] = false;
				orb.mat.dispose();
				orb = makeOrb(makeSeed());
				orbs.current[i] = orb;
				mesh.material = orb.mat;
			}

			// Idle tumble on each orb's own random axis, except the grabbed one.
			if (!reduced && orbDrag.current?.i !== i) {
				spinDelta.setFromAxisAngle(orb.axis, orb.speed * delta);
				orb.spin.multiply(spinDelta);
			}
			// Camera-facing base, then the orb's own spin on top.
			mesh.quaternion.copy(camera.quaternion).multiply(orb.spin);
			// Grow the front of the ring so the centered orb reads bigger.
			mesh.scale.setScalar(1 + FRONT_BOOST * Math.max(0, cosA));
		}

		const idx = ((Math.round(-rot / STEP) % POOL) + POOL) % POOL;
		if (idx !== lastSel.current) {
			lastSel.current = idx;
			onSelect(orbs.current[idx].seed);
		}

		// Anchor the seed label just under the front orb by projecting the
		// front-centre point and its top to screen space, robust to the real
		// orb size and any viewport, unlike a guessed percentage.
		const label = labelRef.current;
		if (label) {
			const frontR = DISC_R * (1 + FRONT_BOOST); // front orb is scaled up
			_projMid.set(0, RING_Y, RING_R).project(camera);
			_projTop.set(0, RING_Y + frontR, RING_R).project(camera);
			const midY = (-_projMid.y * 0.5 + 0.5) * size.height;
			const topY = (-_projTop.y * 0.5 + 0.5) * size.height;
			const bottomY = midY + Math.abs(midY - topY);
			label.style.top = `${Math.round(bottomY + LABEL_GAP)}px`;
		}
	});

	return (
		<>
			{SLOT_KEYS.map((key, i) => (
				<mesh
					key={key}
					geometry={geometry}
					castShadow
					receiveShadow
					ref={(el) => {
						meshes.current[i] = el;
						if (el) el.material = orbs.current[i].mat;
					}}
					onPointerDown={(e) => {
						// Grab this orb; stop the DOM event too so the stage's
						// swipe-to-spin handler doesn't also fire.
						e.stopPropagation();
						const ne = e.nativeEvent as PointerEvent;
						ne.stopPropagation();
						orbDrag.current = { i, x: ne.clientX, y: ne.clientY };
					}}
				/>
			))}
		</>
	);
}

/**
 * Keeps the ring framed across aspect ratios. The wide ring reads fine in
 * landscape at fov 26, but on a narrow/portrait phone that same fov crops in
 * and the front orb balloons, so widen the fov as the viewport narrows
 * (capped, to avoid a fisheye). Camera distance is left alone so the fog
 * cut-offs that hide the reseeding back orbs stay put.
 */
function Rig() {
	const { camera, size } = useThree();
	useEffect(() => {
		const cam = camera as THREE.PerspectiveCamera;
		const aspect = size.width / Math.max(1, size.height);
		cam.fov = aspect >= 1.2 ? 26 : Math.min(42, 26 / Math.max(aspect, 0.5));
		cam.position.set(0, 3, 22);
		cam.lookAt(0, 0, 0);
		cam.updateProjectionMatrix();
	}, [camera, size]);
	return null;
}

export function OrbitDemo() {
	const stageRef = useRef<HTMLDivElement>(null);
	const labelRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef(0);
	const draggingRef = useRef(false);

	const [selectedSeed, setSelectedSeed] = useState("");
	const [canCopy, setCanCopy] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [reduced, setReduced] = useState(false);
	// Coarse pointer ⇒ touch device: lighter render budget (dpr + shadow map).
	const [coarse, setCoarse] = useState(false);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCanCopy(clipboardSupported());
		setMounted(true);
		setReduced(
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
		);
		setCoarse(window.matchMedia?.("(pointer: coarse)").matches ?? false);
	}, []);

	// The audio engine's context is suspended until a user gesture, so the idle
	// detent ticks are silent until you interact. Warm it up on the very first
	// gesture of any kind, not just the switch, so scroll/keys unlock it too.
	useEffect(() => {
		const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
		const unlock = () => {
			tapSound();
			for (const ev of events) window.removeEventListener(ev, unlock);
		};
		for (const ev of events)
			window.addEventListener(ev, unlock, { passive: true });
		return () => {
			for (const ev of events) window.removeEventListener(ev, unlock);
		};
	}, []);

	// Selection changes tick like a detent as each avatar passes the front.
	const handleSelect = useCallback((seed: string) => {
		setSelectedSeed(seed);
		tapSound();
	}, []);

	const spinTo = useCallback((next: number) => {
		targetRef.current = next;
	}, []);

	const step = useCallback(
		(dir: -1 | 1) => {
			spinTo(Math.round(targetRef.current / STEP) * STEP + dir * STEP);
		},
		[spinTo],
	);

	// Wheel spins on either axis, on top of the idle drift (trackpad/mouse).
	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const delta =
				Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
			spinTo(targetRef.current + delta * SENSITIVITY);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [spinTo]);

	// Drag / swipe to spin the ring, the primary gesture on touch (no wheel).
	// Horizontal movement rotates the ring; pointer capture keeps the drag alive
	// if the finger leaves the element.
	useEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		let lastX = 0;
		const onDown = (e: PointerEvent) => {
			// Don't start a ring-spin when the press lands on the copy/download
			// buttons (they sit over the stage).
			if ((e.target as HTMLElement)?.closest?.("[data-orbit-controls]")) return;
			draggingRef.current = true;
			lastX = e.clientX;
			el.setPointerCapture?.(e.pointerId);
		};
		const onMove = (e: PointerEvent) => {
			if (!draggingRef.current) return;
			const dx = e.clientX - lastX;
			lastX = e.clientX;
			spinTo(targetRef.current - dx * DRAG_SENS);
		};
		const onUp = (e: PointerEvent) => {
			draggingRef.current = false;
			el.releasePointerCapture?.(e.pointerId);
		};
		el.addEventListener("pointerdown", onDown);
		el.addEventListener("pointermove", onMove);
		el.addEventListener("pointerup", onUp);
		el.addEventListener("pointercancel", onUp);
		return () => {
			el.removeEventListener("pointerdown", onDown);
			el.removeEventListener("pointermove", onMove);
			el.removeEventListener("pointerup", onUp);
			el.removeEventListener("pointercancel", onUp);
		};
	}, [spinTo]);

	// ←/→ step one avatar.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight") {
				e.preventDefault();
				step(-1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				step(1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [step]);

	const toast = () => window.dispatchEvent(new CustomEvent("show-toast"));

	const onCopy = () => {
		if (!selectedSeed) return;
		void copyAvatar(selectedSeed, "mesh").then((ok) => {
			if (ok) {
				copySound();
				toast();
			} else {
				denySound();
			}
		});
	};

	const onDownload = () => {
		if (!selectedSeed) return;
		void downloadAvatar(selectedSeed, "mesh").then((ok) =>
			ok ? confirmSound() : denySound(),
		);
	};

	return (
		<div className="flex h-[100dvh] flex-col overflow-hidden">
			<div className="w-full px-6 pt-3">
				<SiteHeader />
			</div>

			{/* ── the 3D stage (captures scroll) ── */}
			<div
				ref={stageRef}
				className="relative isolate flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
			>
				{mounted && (
					<Canvas
						shadows
						flat
						camera={{ position: [0, 3, 22], fov: 26 }}
						gl={{
							antialias: !coarse,
							alpha: true,
							powerPreference: "low-power",
						}}
						onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
						// Cap the pixel ratio harder on phones, retina × full-screen
						// fill is the main GPU cost here, and 1.5× is plenty at this size.
						dpr={coarse ? [1, 1.5] : [1, 2]}
					>
						<Rig />
						{/* Match the page background (#000 lifted 4% white) so the far
						    side of the ring fades to invisible, not to a darker disc. */}
						<fog attach="fog" args={["#0a0a0a", 19, 28]} />
						{/* Soft sky/ground fill; the key light gives each sphere its
						    form and a gentle highlight, and casts real shadows onto the
						    orbs behind it. Kept moderate so colours stay saturated. */}
						<hemisphereLight args={["#ffffff", "#181820", 0.35]} />
						<directionalLight
							position={[-7, 8, 9]}
							intensity={0.85}
							castShadow
							shadow-mapSize-width={coarse ? 1024 : 2048}
							shadow-mapSize-height={coarse ? 1024 : 2048}
							shadow-bias={-0.0004}
							shadow-camera-near={0.5}
							shadow-camera-far={45}
							shadow-camera-left={-10}
							shadow-camera-right={10}
							shadow-camera-top={10}
							shadow-camera-bottom={-10}
						/>
						<Ring
							targetRef={targetRef}
							draggingRef={draggingRef}
							reduced={reduced}
							onSelect={handleSelect}
							labelRef={labelRef}
						/>
					</Canvas>
				)}

				{/* Controls overlaid just below the front orb. `Ring` projects the
				    orb's on-screen base each frame and writes this wrapper's `top`,
				    so the seed name always sits 16px under the orb (the home card's
				    gap-4 rhythm) at any orb size or viewport. Click-through so the
				    ring still drags/scrolls; only the buttons take pointer events. */}
				<div
					ref={labelRef}
					className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-4"
					style={{ top: "60%" }}
				>
					<span
						style={{ fontFamily: MONO }}
						className="max-w-[70vw] truncate text-[13px] leading-5 text-white/[0.72]"
						title={selectedSeed}
					>
						<ScrambleText text={selectedSeed} reduced={reduced} />
					</span>
					<div
						data-orbit-controls
						className="pointer-events-auto flex items-center gap-1"
					>
						{canCopy && (
							<IconButton onClick={onCopy} title="Copy to clipboard">
								<ClipboardIcon />
							</IconButton>
						)}
						<IconButton onClick={onDownload} title="Download 2000×2000">
							<DownloadIcon />
						</IconButton>
					</div>
				</div>
			</div>

			<Toast />
		</div>
	);
}
