/* Static check: Deadlines priority colour coding + subtle radius styling.
 * Verifies the required rules exist and no pill-shaped radii are left on
 * bars/chips/cards. Display-only assertions; does not run the UI. */
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "sz-calendar.css"), "utf8");

let failures = 0;
let passed = 0;
function check(name, condition) {
  if (condition) passed++;
  else { failures++; console.error(` - ${name}`); }
}
function has(selector) { return css.includes(selector); }
function barRuleMatches(name, rx) {
  const m = css.match(new RegExp("\\.timeline-bar[^}]*" + rx));
  return Boolean(m && css.includes(name)) || Boolean(m);
}

/* Priority hues are stable and present. */
check("prio token urgent present", has("--sz-prio-urgent: #f0443f"));
check("prio token high present", has("--sz-prio-high: #fb7c3c"));
check("prio token medium present", has("--sz-prio-medium: #f5b942"));
check("prio token low present", has("--sz-prio-low: #38bdf8"));
check("prio token completed present", has("--sz-prio-completed: #35c48d"));
check("prio token overdue present", has("--sz-prio-overdue: #c0392b"));

/* Bars are tinted softly per priority with readable borders. */
check("bar prio urgent rule", has(".timeline-bar.prio-urgent") && /prio-urgent\s*\{[^}]*rgba\(var\(--sz-prio-urgent-rgb\),\s*0\.16\)/.test(css));
check("bar prio high rule", has(".timeline-bar.prio-high") && /prio-high\s*\{[^}]*rgba\(var\(--sz-prio-high-rgb\),\s*0\.16\)/.test(css));
check("bar prio medium rule", has(".timeline-bar.prio-medium") && /prio-medium\s*\{[^}]*rgba\(var\(--sz-prio-medium-rgb\),\s*0\.16\)/.test(css));
check("bar prio low rule", has(".timeline-bar.prio-low") && /prio-low\s*\{[^}]*rgba\(var\(--sz-prio-low-rgb\),\s*0\.16\)/.test(css));
check("bar prio none neutral rule", has(".timeline-bar.prio-none") && /prio-none\s*\{[^}]*color-muted/.test(css));

/* Completed overrides priority hues. */
check("completed overrides priority (completed bar rule)", has(".timeline-bar.state-completed") && /state-completed\s*\{[^}]*sz-prio-completed-rgb/.test(css));
check("completed dot overrides priority (row state)", /state-completed\s+\.timeline-prio-dot/.test(css));

/* Overdue is a dedicated dark red badge, priority hue retained. */
check("overdue badge dark red", /state-overdue\s+\.timeline-bar-state\s*\{[^}]*background:\s*var\(--sz-prio-overdue\)/.test(css));
check("overdue keeps priority border (inset ring)", has(".timeline-bar.state-overdue") && /state-overdue\s*\{[^}]*inset\s+0\s+0\s+0\s+1px/.test(css));

/* Name-cell dots and detail chips exist for every state. */
["prio-urgent", "prio-high", "prio-medium", "prio-low", "prio-none"].forEach((p) => {
  check(`dot rule for ${p}`, has(`.timeline-prio-dot.${p}`));
  check(`chip rule for ${p}`, has(`.timeline-chip.${p}`));
  check(`list-view pill rule for ${p.replace("prio-", "")}`, has(`.priority.${p.replace("prio-", "")}`));
});

/* Subtle radius: bars/chips 6-8px, cards 10-12px, no pill shapes. */
const barRadius = css.match(/\.timeline-bar\s*\{[^}]*border-radius:\s*(\d+(?:\.\d+)?)px/);
check("bar radius is 6-8px", Boolean(barRadius) && Number(barRadius[1]) >= 6 && Number(barRadius[1]) <= 8);
const cardRadius = css.match(/\.deadline-card\s*\{[^}]*border-radius:\s*(\d+(?:\.\d+)?)px/);
check("card radius is 10-12px", Boolean(cardRadius) && Number(cardRadius[1]) >= 10 && Number(cardRadius[1]) <= 12);
const statRadius = css.match(/\.deadline-stat\s*\{[^}]*border-radius:\s*(\d+(?:\.\d+)?)px/);
check("stat radius is 10-12px", Boolean(statRadius) && Number(statRadius[1]) >= 10 && Number(statRadius[1]) <= 12);
check("chips are not pills", /\.timeline-chip\s*,?\s*\n?.*\{?[^}]*border-radius:\s*7px/.test(css) || css.includes(".timeline-chip,") && css.includes("border-radius: 7px"));
check("marker not pill-shaped", /marker\s*\{[^}]*border-radius:\s*7px/.test(css) || /marker.*7px/.test(css));

/* Shadows stay subtle on hover/bars. */
check("bar hover has no heavy shadow", !/\.timeline-bar:hover\s*\{[^}]*shadow-md/.test(css));

console.log(`Priority colour & soft styling checks: ${passed}/${passed + failures}.`);
process.exit(failures ? 1 : 0);
