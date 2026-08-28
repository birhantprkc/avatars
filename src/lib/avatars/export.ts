/**
 * Client-side export helpers: render a seed's avatar at full resolution and
 * hand it back as a Blob, a download, or a clipboard write. Mesh bakes in the
 * signature soft blur; dither stays crisp.
 */

import { drawPattern, isCrisp, type Pattern } from "./patterns";

const EXPORT_SIZE = 2000;

function sanitizeFilename(seed: string): string {
	return (
		seed
			.trim()
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48) || "avatar"
	);
}

/** Render `seed` at 2000×2000. Mesh bakes the blur in; dither is crisp. */
function renderCanvas(
	seed: string,
	pattern: Pattern,
): HTMLCanvasElement | null {
	const base = document.createElement("canvas");
	base.width = EXPORT_SIZE;
	base.height = EXPORT_SIZE;
	const bctx = base.getContext("2d");
	if (!bctx) return null;
	drawPattern(bctx, seed, EXPORT_SIZE, pattern);
	if (isCrisp(pattern)) return base;

	const out = document.createElement("canvas");
	out.width = EXPORT_SIZE;
	out.height = EXPORT_SIZE;
	const octx = out.getContext("2d");
	if (!octx) return null;
	const blur = Math.round(EXPORT_SIZE * 0.06);
	const scale = 1.18;
	const dw = EXPORT_SIZE * scale;
	const offset = (dw - EXPORT_SIZE) / 2;
	octx.filter = `blur(${blur}px)`;
	octx.drawImage(base, -offset, -offset, dw, dw);
	octx.filter = "none";
	return out;
}

export function avatarBlob(
	seed: string,
	pattern: Pattern,
	type: string,
	quality?: number,
): Promise<Blob | null> {
	const canvas = renderCanvas(seed, pattern);
	if (!canvas) return Promise.resolve(null);
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Download the avatar as a JPEG. Resolves false if rendering failed. */
export async function downloadAvatar(
	seed: string,
	pattern: Pattern,
): Promise<boolean> {
	try {
		const blob = await avatarBlob(seed, pattern, "image/jpeg", 0.92);
		if (!blob) return false;
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${pattern === "dither" ? "dither" : "gradient"}-${sanitizeFilename(seed)}.jpg`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		return true;
	} catch {
		return false;
	}
}

/** Copy the avatar as a PNG to the clipboard. Returns false if unsupported. */
export async function copyAvatar(
	seed: string,
	pattern: Pattern,
): Promise<boolean> {
	try {
		const item = new ClipboardItem({
			"image/png": avatarBlob(seed, pattern, "image/png") as Promise<Blob>,
		});
		await navigator.clipboard.write([item]);
		return true;
	} catch {
		return false;
	}
}

export function clipboardSupported(): boolean {
	return (
		typeof navigator !== "undefined" &&
		"clipboard" in navigator &&
		typeof ClipboardItem !== "undefined" &&
		"write" in navigator.clipboard &&
		!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
	);
}
