/**
 * Build the plugin.
 *
 * Figma loads two files and no more: one script for the sandbox and one
 * self-contained HTML file for the panel. So the panel's script is bundled
 * and then written straight into the markup, and neither output asks the
 * network for anything.
 *
 *   node scripts/build.mjs [--watch]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const out = path.join(root, "dist");
const watch = process.argv.includes("--watch");

/**
 * The two brand fonts, inlined as base64 so the panel needs no network. Inter
 * is the sans face and Geist Mono is the value face, the same two the web site
 * self-hosts. Both are variable, so one file covers every weight the panel
 * asks for. The plugin manifest says `networkAccess: none`, so an inlined font
 * is the only way the panel can wear the real type.
 */
const FONT_FILES = {
	InterVar: path.join(repoRoot, "src/app/fonts/InterVariable.woff2"),
	GeistMono: path.join(
		repoRoot,
		"node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
	),
};

async function fontFaces() {
	const faces = await Promise.all(
		Object.entries(FONT_FILES).map(async ([family, file]) => {
			const data = (await readFile(file)).toString("base64");
			return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2')}`;
		}),
	);
	return faces.join("\n");
}

const shared = {
	bundle: true,
	format: "iife",
	// The Figma sandbox is not a browser engine; keep the output plain.
	target: "es2017",
	legalComments: "none",
	logLevel: "info",
	minify: !watch,
};

/** The panel: bundle the script, then inline it into the markup. */
const inlineHtml = {
	name: "inline-html",
	setup(build) {
		build.onEnd(async (result) => {
			const file = result.outputFiles?.[0];
			if (!file) return;
			const template = await readFile(
				path.join(root, "src/ui/index.html"),
				"utf8",
			);
			// A closing tag inside the bundle would end the script early.
			const script = file.text.replace(/<\/script/gi, "<\\/script");
			await mkdir(out, { recursive: true });
			const html = template
				.replace("/* FONTS */", await fontFaces())
				.replace("<!-- bundle -->", `<script>${script}</script>`);
			await writeFile(path.join(out, "ui.html"), html);
		});
	},
};

const builds = [
	{
		...shared,
		entryPoints: [path.join(root, "src/code.ts")],
		outfile: path.join(out, "code.js"),
	},
	{
		...shared,
		entryPoints: [path.join(root, "src/ui/main.ts")],
		outfile: path.join(out, "ui.js"),
		write: false,
		plugins: [inlineHtml],
	},
];

if (watch) {
	for (const options of builds) {
		const context = await esbuild.context(options);
		await context.watch();
	}
	console.log("watching…");
} else {
	await Promise.all(builds.map((options) => esbuild.build(options)));
	console.log(`built → ${path.relative(process.cwd(), out)}`);
}
