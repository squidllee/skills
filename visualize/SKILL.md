---
name: visualize
description: Turn data into a chart or board in the house style. Use when the user wants to see, chart, plot, compare, rank or break down data, asks a question answered mostly by numbers, or ends their response with "html". Not for UI design, mockups or prototypes.
---

# Visualize

## The page
You write only `build()`. The last line loads the locked house library; copy it exactly.

```html
<!doctype html>
<meta charset="utf-8">
<script>
function build() {
  V.header("C: is 81% full, and a third of it is one Steam library", "Scanned 2026-10-17 · 954 GB · folders over 1 GB");
  const g = V.grid();
  V.bars(V.panel(g, "Largest folders", "GB on disk"), {Steam: 244e9, Users: 121e9}, {format:"bytes"});
  V.footer("disk", "board", "du + Get-PSDrive");
}
fetch("C:/Users/chris/.claude/skills/visualize/assets/v.svg").then((r) => r.text()).then((t) => (0, eval)(t.split("<![CDATA[")[1].split("]]>")[0]));
</script>
```

## Rules
- All text is Paper Mono (installed locally; the library sets it). Never add a font.
- Only `V.*` calls inside `build()`. No `<style>`, style attributes, hex colors or DOM code. Never open or copy the library.
- Use real data. If something can't be measured, say so in the deck.
- `html_preview` once and read the console. Fix any `visualize:` warnings and preview once more. Then `html_render`, even if a warning remains. Never preview more than twice. Reply with only the takeaway; the user sees the page.
- Outside T3: save the page, run `python scripts/page.py page.html out.html` and open `out.html`.

## Forms
`V.helper(panel, data, opts)`. Data may be rows, `{label: value}` or `[label, value]` pairs.

| Data | Call |
|---|---|
| One number per thing | `V.bars(p, {Steam: 244e9, Users: 121e9}, {format:"bytes"})` |
| Signed change per thing | `V.diverging(p, {api: 12, web: -8}, {format:"pct"})` |
| A whole in ≤7 parts (more: `V.treemap`) | `V.strip(p, {used: 771e9, empty: 183e9}, {format:"bytes"})` |
| Parts per thing | `V.stacked(p, [{label:"opus", parts:{design: 14, debug: 9}}], {format:"usd"})` |
| Used vs capacity | `V.meter(p, {label:"C:", value: 771e9, total: 954e9, format:"bytes"})` |
| Amount per time bucket | `V.columns(p, [{label:"00:00", value: 4}, …], {format:"usd"})` |
| Level over time | `V.line(p, [{label:"free", points:[240, 220, 183]}], {start:"Oct 1", end:"today"})` |
| Hour × weekday | `V.heatmap(p, {Mon:[0, 3, 1, …], Tue:[…]}, {cols:["00", "06", "12", "18"]})` |
| Nested steps with times | `V.spans(p, [{label:"build", start: 0, end: 168, hi: true}, {label:"tsc", start: 4, end: 90, depth: 1}])` |
| Many spans by kind | `V.lanes(p, [{label:"Bash", spans:[[0, 4], [9, 12]]}], {idle: 30})` |
| Plans with progress | `V.gantt(p, [{label:"v2", start:"2026-10-01", end:"2026-11-20", done: 0.4}])` |
| Pass/fail runs | `V.statusKey(p); V.status(p, {build:["ok", "fail", "skip", null]})` |
| Many values of one measure | `V.dist(p, [92, 88, 104, …], {format:"secs", noun:"runs"})` |
| Two measures per thing | `V.scatter(p, [{x: 120, y: 3600, label:"pr 41"}], {x:{format:"k", label:"lines"}, y:{format:"dur", label:"time to merge"}})` |
| Before vs after per part | `V.change(p, {app:[486e3, 241e3]}, {format:"bytes", better:"lower"})` |
| Headline numbers | `V.stats(null, [{value:"771", unit:"GB", label:"used", delta:"+22 GB", bad: true}])` |
| Exact values | `V.table(p, [{label:"thread"}, {label:"cost", num: true}], [["Viz", "$12.40"]])` |

Formats: `bytes` `usd` `pct` (0–100) `int` `k` `ms` `secs` `dur` `day`, or omit for auto. No data for a slice: `V.empty(p, "why")`.

## Choices
- 1–4 panels; one panel per measure, never grouped bars. No pies, gauges, 3D or dual axes.
- Bars sort descending; `sort:"asc"` when lower is better (say so in the note). About 10 rows; fold the rest into `other`. Free space is `empty`.
- Color is identity: a label keeps its color in every panel (`V.keys({Steam:"blue"})` pins it). Red = problems (`bad:true`), lavender = baseline, orange = outliers.

## Writing
- Title: the finding in one sentence, with the number that proves it. Not a label like "Disk usage".
- Deck: scope · window · source. Panel note: how to read it ("lower is better", "last 24h"). Footer: two-part wordmark + source.
