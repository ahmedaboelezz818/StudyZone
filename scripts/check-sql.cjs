const fs = require("fs");
let s = fs.readFileSync("supabase/migrations/011_fix_team_live_start_call_ambiguous.sql", "utf8");
// strip block comments, line comments, and string literals
let t = s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
t = t.replace(/'(?:[^']|'')*'/g, "''");
const o = (t.match(/\(/g) || []).length;
const c = (t.match(/\)/g) || []).length;
console.log("parens stripped:", o, c, o === c ? "OK" : "MISMATCH");
console.log("drop function statements:", (t.match(/drop function/gi) || []).length);
console.log("create or replace function:", (t.match(/create or replace function/gi) || []).length);
console.log("returns uuid:", (t.match(/returns uuid/gi) || []).length);
console.log("grants:", (t.match(/grant execute/gi) || []).length);
console.log("alter table:", (t.match(/alter table/gi) || []).length);
console.log("create table:", (t.match(/create table/gi) || []).length);
console.log("insert into public.team_calls:", (t.match(/insert into public\.team_calls/gi) || []).length);
console.log("insert into public.team_call_participants:", (t.match(/insert into public\.team_call_participants/gi) || []).length);
console.log("membership checks:", (t.match(/team_members/gi) || []).length);
console.log("cascade anywhere:", /cascade/i.test(t));
