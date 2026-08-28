/**
 * How many avatars one insert makes, and what each of them is seeded with.
 *
 * With a selection, the selection decides: one avatar per selected frame or
 * shape, so laying out a row of six cards and pressing Insert gives back six
 * avatars, not one per line of a box nobody edited. With nothing selected the
 * typed seeds decide, which is the plugin's original behaviour.
 *
 * This is separate from the panel because the panel is a DOM file and this is
 * the rule worth testing.
 */

export interface SeedPlan {
	/** The seeds to build, in order. One avatar each. */
	seeds: string[];
	/** True when the selection set the count, not the seeds box. */
	fromSelection: boolean;
	/** How many layers were selected, before the cap. */
	selected: number;
	/** True when the cap cut the list short. */
	capped: boolean;
}

export interface SeedInput {
	/** Lines from the seeds box, already trimmed and stripped of blanks. */
	typed: string[];
	/** Names of the selected layers, in selection order. */
	names: string[];
	/** Seed each avatar from the layer it belongs to. */
	fromName: boolean;
	/** Never build more than this many in one go. */
	max: number;
}

/**
 * Resolve one insert.
 *
 * Nothing selected: the typed seeds, capped.
 *
 * Something selected: one seed per selected layer, capped. The layer's own
 * name is the seed when that option is on, so a frame called "Ada Lovelace"
 * always gets Ada's avatar. Otherwise the typed seeds repeat across the
 * selection, and a layer falls back to its name when nothing was typed.
 */
export function planSeeds(input: SeedInput): SeedPlan {
	const { typed, names, fromName, max } = input;
	const cap = Math.max(0, Math.floor(max));

	if (names.length === 0) {
		return {
			seeds: typed.slice(0, cap),
			fromSelection: false,
			selected: 0,
			capped: typed.length > cap,
		};
	}

	const seeds = names.slice(0, cap).map((name, index) => {
		if (fromName && name.trim()) return name;
		if (typed.length) return typed[index % typed.length];
		return name;
	});

	return {
		seeds,
		fromSelection: true,
		selected: names.length,
		capped: names.length > cap,
	};
}
