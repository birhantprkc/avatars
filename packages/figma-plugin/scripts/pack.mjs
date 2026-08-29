/**
 * Pack the plugin for download.
 *
 * The site offers the plugin as a single zip. A user unzips it, then points
 * Figma at the manifest inside. So this builds the two output files, stages
 * them next to the manifest and a short import note, and writes one zip into
 * the site's public folder.
 *
 *   node scripts/pack.mjs
 *
 * The zip is a committed static asset. Run this after a plugin change, then
 * commit the new zip. The Vercel build only serves it; it does not repack.
 */

import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const dist = path.join(root, "dist");
const publicDir = path.join(repoRoot, "public");

// The folder name a user sees after they unzip. The manifest sits at its top
// and its `dist/` paths resolve from there, so Figma imports it as-is.
const FOLDER = "avatars-figma-plugin";
const ZIP_NAME = `${FOLDER}.zip`;

/** What a first-time user reads before they import. */
const IMPORT_NOTE = `Avatars for Figma
=================

Install (Figma desktop app):

  1. Open the Figma desktop app. Import works in the desktop app only.
  2. Open any file.
  3. Menu: Plugins -> Development -> Import plugin from manifest...
  4. Choose the manifest.json in this folder.
  5. Run it from Plugins -> Development -> Avatars.

Keep this folder where it is. Figma reads the plugin from these files each
time it runs, so it must stay on disk.

The plugin needs no network. Every avatar is generated from its seed on the
spot. Nothing is fetched and nothing is uploaded.

Docs: https://avatars.outpacestudios.com/figma-plugin
`;

async function main() {
	// Build fresh, so the zip never ships a stale bundle.
	await run("node", [path.join(root, "scripts/build.mjs")], { cwd: root });

	const work = await mkdtemp(path.join(tmpdir(), "avatars-plugin-"));
	const stage = path.join(work, FOLDER);
	try {
		await mkdir(path.join(stage, "dist"), { recursive: true });
		await cp(path.join(root, "manifest.json"), path.join(stage, "manifest.json"));
		await cp(path.join(dist, "code.js"), path.join(stage, "dist/code.js"));
		await cp(path.join(dist, "ui.html"), path.join(stage, "dist/ui.html"));
		await writeFile(path.join(stage, "README.txt"), IMPORT_NOTE);

		await mkdir(publicDir, { recursive: true });
		const outZip = path.join(publicDir, ZIP_NAME);
		await rm(outZip, { force: true });
		// -r recurse, -q quiet, -X drop extra file attributes for a stable zip.
		await run("zip", ["-r", "-q", "-X", outZip, FOLDER], { cwd: work });

		console.log(`packed → ${path.relative(process.cwd(), outZip)}`);
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
