/* Unit tests for the shared calendar / deadline timeline maths.
 * Run with: node tests/timeline-core.js
 */
const path = require("node:path");

const timeline = require(path.join(__dirname, "..", "timeline-core.js"));

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` (${detail})` : ""}`);
}

function equal(name, actual, expected) {
  check(name, actual === expected, `expected ${expected}, got ${actual}`);
}

/* ------------------------------------------------------------------ *
 * Day arithmetic: leap years, month and year boundaries
 * ------------------------------------------------------------------ */
equal("dayDiff counts a normal 3 day span", timeline.dayDiff("2026-01-01", "2026-01-03"), 2);
equal("dayDiff across a month boundary", timeline.dayDiff("2026-01-30", "2026-02-02"), 3);
equal("dayDiff across a year boundary", timeline.dayDiff("2026-12-29", "2027-01-03"), 5);
equal("dayDiff handles February in a leap year", timeline.dayDiff("2024-02-28", "2024-03-01"), 2);
equal("dayDiff handles February in a common year", timeline.dayDiff("2026-02-28", "2026-03-01"), 1);
equal("daysInMonth detects leap February", timeline.daysInMonth(2024, 1), 29);
equal("daysInMonth detects common February", timeline.daysInMonth(2026, 1), 28);
equal("isLeapYear 2024", timeline.isLeapYear(2024), true);
equal("isLeapYear 1900", timeline.isLeapYear(1900), false);
equal("isLeapYear 2000", timeline.isLeapYear(2000), true);

equal("addDays crosses a month boundary", timeline.addDays("2026-01-31", 1), "2026-02-01");
equal("addDays crosses a year boundary", timeline.addDays("2026-12-31", 1), "2027-01-01");
equal("addDays walks backwards over a leap day", timeline.addDays("2024-03-01", -1), "2024-02-29");
equal("addMonths clamps to the last day", timeline.addMonths("2026-01-31", 1), "2026-02-28");
equal("addMonths crosses a year boundary", timeline.addMonths("2026-11-15", 3), "2027-02-15");
equal("keyOf formats a local date", timeline.keyOf(new Date(2026, 0, 5)), "2026-01-05");
equal("parseKey rejects junk", timeline.parseKey("nope"), null);

/* ------------------------------------------------------------------ *
 * Bar width is proportional to the real number of days
 * ------------------------------------------------------------------ */
const WINDOW = "2026-06-01";

function barFor(start, end, windowKey = WINDOW) {
  return timeline.barGeometry(
    { startKey: start, endKey: end, hasStart: true, hasEnd: true },
    windowKey,
    45,
    34,
  );
}

const bar3 = barFor("2026-06-01", "2026-06-03");
const bar7 = barFor("2026-06-01", "2026-06-07");
const bar14 = barFor("2026-06-01", "2026-06-14");
const bar30 = barFor("2026-06-01", "2026-06-30");

equal("3 day project spans exactly 3 day cells", bar3.spanDays, 3);
equal("7 day project spans exactly 7 day cells", bar7.spanDays, 7);
equal("14 day project spans exactly 14 day cells", bar14.spanDays, 14);
equal("30 day project spans exactly 30 day cells", bar30.spanDays, 30);

equal("3 day bar width is 3 x day width", bar3.width, 3 * 34);
equal("7 day bar width is 7 x day width", bar7.width, 7 * 34);
equal("14 day bar width is 14 x day width", bar14.width, 14 * 34);
equal("30 day bar width is 30 x day width", bar30.width, 30 * 34);

check("7 day bar is longer than the 3 day bar", bar7.width > bar3.width);
check("14 day bar is longer than the 7 day bar", bar14.width > bar7.width);
check("30 day bar is longer than the 14 day bar", bar30.width > bar14.width);
equal(
  "doubling the days exactly doubles the width",
  barFor("2026-06-01", "2026-06-14").width,
  barFor("2026-06-01", "2026-06-07").width * 2,
);
equal(
  "bar start offset follows the real start date",
  barFor("2026-06-11", "2026-06-13").left,
  10 * 34,
);

/* zoom changes keep the real duration, only the scale changes */
const dayZoomBar = timeline.barGeometry(
  { startKey: "2026-06-01", endKey: "2026-06-14", hasStart: true, hasEnd: true },
  "2026-06-01",
  timeline.windowDays("day"),
  timeline.dayWidth("day"),
);
const quarterZoomBar = timeline.barGeometry(
  { startKey: "2026-06-01", endKey: "2026-06-14", hasStart: true, hasEnd: true },
  "2026-06-01",
  timeline.windowDays("quarter"),
  timeline.dayWidth("quarter"),
);
equal("zoom never changes the real duration (day)", dayZoomBar.spanDays, 14);
equal("zoom never changes the real duration (quarter)", quarterZoomBar.spanDays, 14);
equal(
  "zoom only rescales the pixel width",
  quarterZoomBar.width,
  14 * timeline.dayWidth("quarter"),
);

/* ------------------------------------------------------------------ *
 * Multi month / multi year spans and clipping
 * ------------------------------------------------------------------ */
const crossMonth = barFor("2026-01-25", "2026-02-10", "2026-01-01");
equal("span across two months", crossMonth.spanDays, 17);
const crossYear = barFor("2026-12-20", "2027-01-10", "2026-12-01");
equal("span across two years", crossYear.spanDays, 22);
const leapProject = barFor("2024-02-25", "2024-03-05", "2024-02-01");
equal("span across a leap February", leapProject.spanDays, 10);

const clipped = barFor("2026-05-25", "2026-06-05");
check("bars before the window are clipped on the left", clipped && clipped.clippedStart === true);
check("bars after the window are clipped on the right", barFor("2026-07-20", "2026-07-25") === null);
equal(
  "a bar starting before the window starts at the window edge",
  barFor("2026-05-25", "2026-06-05").left,
  0,
);

/* ------------------------------------------------------------------ *
 * Deadline without a start date -> marker, never a fabricated bar
 * ------------------------------------------------------------------ */
const endOnly = timeline.itemRange({ due_at: "2026-06-10T12:00:00.000Z" });
equal("end only item has no start", endOnly.hasStart, false);
equal("end only item keeps its real end", endOnly.endKey != null, true);
equal(
  "end only item is a single day, not a fabricated span",
  timeline.spanDays(endOnly),
  1,
);
const marker = timeline.markerGeometry(endOnly.endKey, WINDOW, 45, 34);
check("end only item renders as a marker inside the window", Boolean(marker));
equal(
  "marker sits on its real day",
  marker.left,
  timeline.dayDiff(WINDOW, endOnly.endKey) * 34 + 17,
);
equal(
  "marker outside the window is dropped",
  timeline.markerGeometry("2030-01-01", WINDOW, 45, 34),
  null,
);

/* start only item stays open ended and never invents an end date */
const startOnly = timeline.itemRange({ starts_at: "2026-06-05T09:00:00.000Z" });
equal("start only item has no end", startOnly.hasEnd, false);
equal("start only item keeps a null end key", startOnly.endKey, null);
const openBar = timeline.barGeometry(startOnly, WINDOW, 45, 34);
check("start only item still renders from its start", Boolean(openBar));
equal("open ended bar is flagged as open ended", openBar.openEnded, true);
equal("open ended bar never claims a fake span", openBar.clippedEnd, true);
equal("open ended bar reaches the window edge", openBar.left + openBar.width, 45 * 34);

/* items without any date are not timeline items at all */
equal(
  "undated item has no range",
  timeline.itemRange({ title: "no dates" }),
  null,
);

/* ------------------------------------------------------------------ *
 * Current day line position
 * ------------------------------------------------------------------ */
const anchor = "2026-06-10";
const dayWindowStart = timeline.windowStart(anchor, "day");
const todayOffset = timeline.dayIndex(anchor, dayWindowStart) * timeline.dayWidth("day");
equal("today line sits one lead-day into the day window", todayOffset, 1 * 168);
equal(
  "today line position scales with zoom",
  timeline.dayIndex(anchor, timeline.windowStart(anchor, "quarter")) *
    timeline.dayWidth("quarter"),
  25 * 14,
);

/* ------------------------------------------------------------------ *
 * Classification: ordinary daily tasks never enter the timeline
 * ------------------------------------------------------------------ */
const ordinaryTask = { id: "a", title: "Read chapter", due_at: "2026-06-10T23:59:00.000Z" };
const durationTask = {
  id: "b",
  title: "Lab report",
  starts_at: "2026-06-01T09:00:00.000Z",
  due_at: "2026-06-14T23:59:00.000Z",
};
const routineTask = { id: "routine:1:2026-06-10", routine_id: "1", due_at: "2026-06-10T23:59:00.000Z" };

check("ordinary task with only a due date is excluded", !timeline.isTimelineItem(ordinaryTask));
check("routine occurrences are excluded", !timeline.isTimelineItem(routineTask));
check("task with a real start date is included", timeline.isTimelineItem(durationTask));
check(
  "explicitly flagged deadline is included",
  timeline.isTimelineItem({ ...ordinaryTask }, { kind: "deadline" }),
);
check(
  "explicitly flagged ordinary task stays excluded",
  !timeline.isTimelineItem({ ...durationTask }, { kind: "task" }),
);
check(
  "explicit classification beats the derived one",
  timeline.classify(durationTask, { kind: "task" }).kind === "task",
);
check(
  "phase classification keeps its parent",
  timeline.classify(durationTask, { kind: "phase:project-1" }).parent === "project-1",
);
check(
  "derived classification of a plain task is 'task'",
  timeline.classify(ordinaryTask).kind === "task",
);

/* ------------------------------------------------------------------ *
 * Status and progress
 * ------------------------------------------------------------------ */
const day = "2026-06-10";
equal(
  "finished item is completed",
  timeline.stateOf({ status: "completed", due_at: "2026-06-01T00:00:00Z" }, day),
  "completed",
);
equal(
  "past due item is overdue",
  timeline.stateOf({ due_at: "2026-06-01T00:00:00Z" }, day),
  "overdue",
);
equal(
  "started item is active",
  timeline.stateOf(
    { starts_at: "2026-06-01T00:00:00Z", due_at: "2026-06-20T00:00:00Z" },
    day,
  ),
  "active",
);
equal(
  "future item is backlog",
  timeline.stateOf(
    { starts_at: "2026-07-01T00:00:00Z", due_at: "2026-07-20T00:00:00Z" },
    day,
  ),
  "backlog",
);

equal("completed item reports 100%", timeline.progressOf({ status: "completed" }, []), 100);
equal(
  "project progress comes from its phases",
  timeline.progressOf(
    {},
    [{ status: "completed" }, { status: "completed" }, { status: "not_started" }, { status: "not_started" }],
  ),
  50,
);
equal("no progress data returns null, never a fake number", timeline.progressOf({}, []), null);

/* ------------------------------------------------------------------ *
 * Calendar grid
 * ------------------------------------------------------------------ */
const grid = timeline.monthGrid(2026, 5); // June 2026
equal("month grid always has 6 weeks", grid.length, 6);
equal("month grid always has 7 columns", grid[0].length, 7);
const gridStartParts = timeline.parseKey(grid[0][0].key);
const gridStartWeekday = new Date(
  Date.UTC(gridStartParts.y, gridStartParts.m - 1, gridStartParts.d),
).getUTCDay();
equal("month grid starts on a Sunday", gridStartWeekday, 0);
check(
  "month grid covers every day of June 2026",
  grid.flat().filter((cell) => cell.inMonth).length === 30,
);
const leapGrid = timeline.monthGrid(2024, 1); // February 2024
check(
  "leap February grid covers 29 days",
  leapGrid.flat().filter((cell) => cell.inMonth).length === 29,
);
equal("week starts on Sunday", timeline.weekDayKeys("2026-06-10")[0], "2026-06-07");
equal("week has 7 days", timeline.weekDayKeys("2026-06-10").length, 7);

/* ------------------------------------------------------------------ *
 * Zoom navigation
 * ------------------------------------------------------------------ */
equal("unknown zoom falls back to month", timeline.normalizeZoom("nope"), "month");
equal("quarter shift moves 3 months", timeline.shiftAnchor("2026-06-10", "quarter", 1), "2026-09-10");
equal("month shift moves 1 month", timeline.shiftAnchor("2026-01-31", "month", 1), "2026-02-28");
equal("week shift moves 7 days", timeline.shiftAnchor("2026-06-10", "week", -1), "2026-06-03");
equal("day shift moves 1 day", timeline.shiftAnchor("2026-06-10", "day", 1), "2026-06-11");
equal(
  "window start never changes the number of visible days",
  timeline.windowDays("month"),
  45,
);

/* ------------------------------------------------------------------ *
 * Deadlines screen mandatory eligibility rule
 *   only real two-or-more-day items belong (display rule)
 * ------------------------------------------------------------------ */
equal("1-day task does NOT belong to Deadlines", timeline.isMultiDayItem({ id: "t1", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-10T18:00:00" }), false);
equal("2-day task belongs to Deadlines", timeline.isMultiDayItem({ id: "t2", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-11T18:00:00" }), true);
equal("3-day task belongs to Deadlines", timeline.isMultiDayItem({ id: "t3", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-12T18:00:00" }), true);
equal("7-day task spans the week and belongs", timeline.isMultiDayItem({ id: "t4", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-16T09:00:00" }), true);
equal("30-day task belongs to Deadlines", timeline.isMultiDayItem({ id: "t5", starts_at: "2026-06-01T09:00:00", due_at: "2026-06-30T09:00:00" }), true);
equal("due-date-only task does NOT belong", timeline.isMultiDayItem({ id: "t6", due_at: "2026-06-30T09:00:00" }), false);
equal("start-only task does NOT belong", timeline.isMultiDayItem({ id: "t7", starts_at: "2026-06-10T09:00:00" }), false);
equal("undated task does NOT belong", timeline.isMultiDayItem({ id: "t8" }), false);
equal("daily recurring task does NOT belong", timeline.isMultiDayItem({ id: "t9", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-20T09:00:00", recurrence_type: "daily" }), false);
equal("recurring routine does NOT belong", timeline.isMultiDayItem({ id: "routine:t10", routine_id: "routine-1", starts_at: "2026-06-10T09:00:00", due_at: "2026-06-20T09:00:00" }), false);
equal("two weeks, one iso boundary both produce the same span", timeline.isMultiDayItem({ id: "t11", starts_at: "2026-12-05T00:00:00", due_at: "2026-12-19T00:00:00" }), true);

/* ------------------------------------------------------------------ *
 * Calendar exact-date matching (YYYY-MM-DD, never day-of-month only)
 * ------------------------------------------------------------------ */
const nov7 = { id: "nov7", title: "November task", due_at: "2026-11-07T23:59:00" };
const dec7 = { id: "dec7", title: "December task", due_at: "2026-12-07T23:59:00" };
const nov21 = { id: "nov21", title: "Nov 21", starts_at: "2026-11-21T09:00:00", due_at: "2026-11-21T18:00:00" };
const oct21 = { id: "oct21", title: "Oct 21", due_at: "2026-10-21T18:00:00" };

check("Nov 7 task appears on 2026-11-07", timeline.taskOccursOnDay(nov7, "2026-11-07"));
check("Nov 7 task does NOT appear on 2026-12-07", !timeline.taskOccursOnDay(nov7, "2026-12-07"));
check("Dec 7 task does NOT appear on 2026-11-07", !timeline.taskOccursOnDay(dec7, "2026-11-07"));
check("Nov 21 task appears on 2026-11-21", timeline.taskOccursOnDay(nov21, "2026-11-21"));
check("Nov 21 task does NOT appear on 2026-10-21", !timeline.taskOccursOnDay(nov21, "2026-10-21"));
check("Oct 21 task does NOT appear on 2026-11-21", !timeline.taskOccursOnDay(oct21, "2026-11-21"));

/* Same day-of-month in two months: each stays on its own date. */
const sameDayPairs = [nov7, dec7];
equal(
  "same day-of-month: Nov 7 only matches the November task",
  sameDayPairs.filter((task) => timeline.taskOccursOnDay(task, "2026-11-07")).map((task) => task.id).join(","),
  "nov7",
);
equal(
  "same day-of-month: Dec 7 only matches the December task",
  sameDayPairs.filter((task) => timeline.taskOccursOnDay(task, "2026-12-07")).map((task) => task.id).join(","),
  "dec7",
);

/* Same month, different weeks. */
const week1 = { id: "w1", due_at: "2026-11-03T12:00:00" };
const week3 = { id: "w3", due_at: "2026-11-17T12:00:00" };
check("week 1 task appears in its own week", timeline.taskOccursOnDay(week1, "2026-11-03"));
check("week 1 task does not leak into week 3", !timeline.taskOccursOnDay(week1, "2026-11-17"));
check("week 3 task does not leak into week 1", !timeline.taskOccursOnDay(week3, "2026-11-03"));

/* Same-day start + end, multi-day spans and all-day tasks. */
const sameDaySpan = {
  id: "same",
  starts_at: "2026-11-07T08:00:00",
  due_at: "2026-11-07T22:00:00",
};
check("task that starts and ends on one day appears that day", timeline.taskOccursOnDay(sameDaySpan, "2026-11-07"));
check("same-day task does not appear the day after", !timeline.taskOccursOnDay(sameDaySpan, "2026-11-08"));

const multiDay = {
  id: "multi",
  starts_at: "2026-11-05T09:00:00",
  due_at: "2026-11-09T18:00:00",
};
["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"].forEach((key) => {
  check(`multi-day task covers ${key}`, timeline.taskOccursOnDay(multiDay, key));
});
check("multi-day task does not appear before its start", !timeline.taskOccursOnDay(multiDay, "2026-11-04"));
check("multi-day task does not appear after its end", !timeline.taskOccursOnDay(multiDay, "2026-11-10"));

const allDay = { id: "all-day", is_all_day: true, due_at: "2026-11-07T23:59:00" };
check("all-day task appears on its own date", timeline.taskOccursOnDay(allDay, "2026-11-07"));
check("all-day task does not shift to the previous date", !timeline.taskOccursOnDay(allDay, "2026-11-06"));
check("all-day task does not shift to the next date", !timeline.taskOccursOnDay(allDay, "2026-11-08"));

/* Every stored occurrence of a recurring series is on its own date only. */
const series = [
  { id: "r1", recurrence_group_id: "g", due_at: "2026-11-01T23:59:00" },
  { id: "r2", recurrence_group_id: "g", due_at: "2026-11-02T23:59:00" },
  { id: "r3", recurrence_group_id: "g", due_at: "2026-11-03T23:59:00" },
];
equal(
  "recurring series shows one occurrence per applicable date",
  series.filter((task) => timeline.taskOccursOnDay(task, "2026-11-02")).map((task) => task.id).join(","),
  "r2",
);
check("recurring series does not repeat on an unrelated date", timeline.taskOccursOnDay({ due_at: "2026-11-09T23:59:00", recurrence_group_id: "g", recurrence_type: "weekly" }, "2026-11-10") === false);

/* Date-only and wall-clock values must never move a day because of UTC. */
equal("date-only parsing stays on the same local day", timeline.keyOf(timeline.localInstant("2026-11-07")), "2026-11-07");
equal("wall-clock parsing stays on the same local day", timeline.keyOf(timeline.localInstant("2026-11-07T23:59")), "2026-11-07");
equal("invalid calendar dates are rejected, never rolled over", timeline.localInstant("2026-02-31"), null);
equal(
  "taskDayKeys returns the real local start and end",
  JSON.stringify(timeline.taskDayKeys({ starts_at: "2026-11-05T01:00:00", due_at: "2026-11-09T23:00:00" })),
  JSON.stringify({ startKey: "2026-11-05", endKey: "2026-11-09" }),
);

/* Online and offline datasets (same rows, different array instances) agree. */
const onlineRows = [
  { id: "a", due_at: "2026-11-07T10:00:00" },
  { id: "b", due_at: "2026-12-07T10:00:00" },
];
const offlineRows = JSON.parse(JSON.stringify(onlineRows));
const keys = ["2026-11-07", "2026-12-07", "2026-11-21"];
equal(
  "online and offline filtering produce identical days",
  keys.map((key) => onlineRows.filter((task) => timeline.taskOccursOnDay(task, key)).map((task) => task.id).join(",")).join("|"),
  keys.map((key) => offlineRows.filter((task) => timeline.taskOccursOnDay(task, key)).map((task) => task.id).join(",")).join("|"),
);

if (failures.length) {
  console.error(`Timeline core tests failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Timeline core tests passed: ${passed}/${passed}.`);
