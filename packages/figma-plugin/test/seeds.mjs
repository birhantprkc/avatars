/**
 * Tests for the rule that decides how many avatars one insert makes.
 *
 * The promise is that the selection wins: select six frames, get six avatars.
 * Everything else here guards the edges of that promise, because the panel
 * cannot be run in Node and this is where the counting lives.
 */
import { planSeeds } from "../src/seeds.ts";

let failures = 0;
const check = (name, ok, detail = "") => {
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
	if (!ok) failures++;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const TYPED = ["jane@example.com", "acme", "outpace"];
const base = { typed: TYPED, names: [], fromName: true, max: 24 };

/* ── nothing selected: the seeds box decides ── */

const none = planSeeds(base);
check("no selection: the typed seeds are the list", same(none.seeds, TYPED));
check("no selection: not driven by the selection", none.fromSelection === false);
check("no selection: nothing selected", none.selected === 0);

check(
	"no selection: an empty box gives no avatars",
	planSeeds({ ...base, typed: [] }).seeds.length === 0,
);

check(
	"no selection: the cap still applies",
	(() => {
		const many = Array.from({ length: 30 }, (_, i) => `seed-${i}`);
		const plan = planSeeds({ ...base, typed: many });
		return plan.seeds.length === 24 && plan.capped === true;
	})(),
);

/* ── a selection decides the count ── */

const NAMES = ["Ada", "Grace", "Katherine", "Dorothy", "Mary", "Annie"];

const six = planSeeds({ ...base, names: NAMES });
check("selection: one avatar per selected layer", six.seeds.length === 6);
check("selection: the count comes from the selection", six.fromSelection === true);
check("selection: the selected count is reported", six.selected === 6);
check("selection: not capped at six", six.capped === false);

check(
	"selection: each layer is seeded from its own name",
	same(six.seeds, NAMES),
);

check(
	"selection: one selected layer gives one avatar",
	planSeeds({ ...base, names: ["Ada"] }).seeds.length === 1,
);

/* ── seeding from the box instead of the name ── */

const cycled = planSeeds({ ...base, names: NAMES, fromName: false });
check(
	"selection: typed seeds repeat across the selection",
	same(cycled.seeds, [
		"jane@example.com",
		"acme",
		"outpace",
		"jane@example.com",
		"acme",
		"outpace",
	]),
);
check(
	"selection: the count still follows the selection, not the box",
	cycled.seeds.length === NAMES.length,
);

check(
	"selection: an empty box falls back to the layer names",
	same(planSeeds({ typed: [], names: NAMES, fromName: false, max: 24 }).seeds, NAMES),
);

check(
	"selection: a blank layer name falls back to a typed seed",
	same(planSeeds({ ...base, names: ["  ", "Grace"] }).seeds, [
		"jane@example.com",
		"Grace",
	]),
);

/* ── the cap ── */

const lots = Array.from({ length: 40 }, (_, i) => `Layer ${i}`);
const capped = planSeeds({ ...base, names: lots });
check("selection: the cap holds the count down", capped.seeds.length === 24);
check("selection: the cap is reported", capped.capped === true);
check(
	"selection: the true selected count survives the cap",
	capped.selected === 40,
);
check(
	"selection: the capped list is the first layers, in order",
	same(capped.seeds, lots.slice(0, 24)),
);

/* ── determinism ── */

check(
	"the same input always gives the same list",
	same(planSeeds({ ...base, names: NAMES }), planSeeds({ ...base, names: NAMES })),
);

console.log(failures ? `\n${failures} failing` : "\nall good");
process.exit(failures ? 1 : 0);
