# osu-beatmap-preview [WIP]

[![CI](https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/ci.yml)
[![Publish to npm](https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/publish.yml/badge.svg?event=release)](https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/osu-beatmap-preview)](https://www.npmjs.com/package/osu-beatmap-preview)

An osu!standard beatmap renderer based on [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview) that utilizes HTML canvas.

The package uses `osu-parsers`, `osu-classes`, and `osu-standard-stable` for most non-rendering work. The goal is to provide a ready-to-use library that lets developers render osu! beatmap previews in a lightweight way while keeping playback controls, UI, fetching, and application integration in userland.

## Features

- Beatmap combo colors.
- Correctly computed complex slider shapes. The original `osu-preview` implementation freezes on Bezier sliders with multiple anchors due to incorrect computation. It is mathematically correct for a Bezier curve, but osu! uses approximation for Beziers. For more details, see [PathApproximator.cs#L79](https://github.com/ppy/osu-framework/blob/master/osu.Framework/Utils/PathApproximator.cs#L79).
- Aspire maps are supported.
- Catmull sliders are rendered correctly.
- Argon-style slider ball, follow circle, repeats, and score-point ticks.
- Argon-style spinners with rotating ticks, progress arcs, glow, and entrance/completion animations. Spinner progress is driven by elapsed time for preview playback.
- Animated Argon follow points between consecutive objects in the same combo, with stacked slider endpoints and deterministic seeking. They are always enabled in standard playfield views, independently of autoplay.
- Multiple previews can be created at once without noticeable performance drawbacks.
- Canvas-first API with no React, browser extension, or UI dependency.
- osu!standard mod bitmasks can be passed when loading a beatmap.
- Torus font assets are included for combo number rendering.
- A centered hitobject timeline with zoom, combo colors, slider/spinner durations, and a timing-aligned ruler with configurable beat subdivisions.

## Missing, Planned Features

- Slider tails are not fully implemented.
- Full skinning API.
- Mania rendering is not part of the public package yet.

## Installation

```bash
npm install osu-beatmap-preview
```

## Autoplay cursor

Standard playfield previews and direct renderers accept `autoplay: true` as an opt-in constructor option:

```ts
const preview = new StandardBeatmapPreviewer(canvas, {autoplay: true});
const prepared = preview.loadBeatmapText(osuText);
preview.render(1000);
preview.cursorTrail = false; // Hide the trail while keeping the autoplay cursor.
preview.autoplay = false; // Takes effect on the next render; persists across map loads.

const renderer = new StandardBeatmapRenderer(context, prepared, {autoplay: true});
renderer.render(1000);
renderer.dispose();
```

The `cursorTrail` constructor option and getter/setter are available on both classes. It defaults to `true`; changes take effect on the next render and previewer settings persist across map loads. Use `{autoplay: true, cursorTrail: false}` for a cursor without a trail.

The procedural Argon cursor follows osu! autoplay movement, tracks repeated sliders, and circles spinners. Its trail and press animations support arbitrary seeking, preview offsets, and clock-rate mods. Autoplay supplies visual cursor movement; existing successful-hit animations remain unchanged. No scoring, manual input, audio, or replay import is added. Timeline views have no cursor option. See [ROADMAP.md](ROADMAP.md) for the subsequent skinning work.

## Migrating from 0.3.0

Beatmap preparation now returns an opaque `PreparedBeatmap` handle. Construct `BeatmapLoader` without a ruleset argument, attach the handle to views, and read metadata through `prepared.beatmap`:

```ts
import {BeatmapLoader, StandardBeatmapRenderer} from "osu-beatmap-preview";

const loader = new BeatmapLoader();
const prepared = loader.loadBeatmapText(osuText, {mods: 0});
preview.loadPreparedBeatmap(prepared);
timeline.loadPreparedBeatmap(prepared);
console.log(prepared.beatmap.metadata.title, prepared.clockRate);

// Direct renderers also receive the handle.
const renderer = new StandardBeatmapRenderer(canvas.getContext("2d")!, prepared);
console.log(renderer.beatmap);
renderer.dispose();
```

- Loader and previewer loading methods return the handle rather than the underlying map.
- `loadPreparedBeatmap()` and direct renderer constructors accept only handles returned by this library; raw maps and copied handles are rejected.
- Previewer `beatmap` still exposes the underlying read-only model. Direct renderer `getBeatmap` is renamed to `beatmap`.
- `loadBeatmap()` accepts a decoded map or an existing handle; it prepares a new handle from the pristine source and replaces mods rather than compounding them.
- `resize()` requires positive finite dimensions and DPR. Identical resizes preserve raster caches.
- Playback arguments remain playback milliseconds. With `useBeatmapPreviewTime`, the map's preview offset is added in playback milliseconds before applying clock rate, preserving 0.3.0 semantics.

Consumers configure built-in standard views. Ruleset adapters, projections, appearances, and drawable models are internal; custom ruleset/model extension is not a supported API. Package deep imports remain blocked by the exports map.

## Migrating from 0.2.0

Version 0.3.0 includes breaking API changes. Update these imports and options:

| 0.2.0 | 0.3.0 |
| --- | --- |
| `StandardBeatmapPreview` | `StandardBeatmapPreviewer` |
| `StandardRenderer` | `StandardBeatmapRenderer` |
| `PlayfieldOffset` | `Offset` |
| `BeatmapPreviewOptions.playfieldOffset` | `BeatmapPreviewOptions.offset` |

```ts
import {StandardBeatmapPreviewer, type Offset} from "osu-beatmap-preview";

const offset: Offset = {x: 64, y: 48};
const preview = new StandardBeatmapPreviewer(canvas, {offset});
```

The standard preview now scales and centers its 640 × 480 logical playfield to fit the canvas. Custom offsets are measured in logical playfield coordinates and scale with it. If your application previously compensated for a fixed-size playfield, update that sizing logic to use the previewer's `resize()` method.

The existing loading and rendering methods remain available. When integrating `StandardBeatmapRenderer` directly, call `dispose()` when finished to release its cached rendering surfaces; previewers handle this lifecycle automatically.

If you subclassed `StandardRenderer` to override its protected `DEFAULT_COLORS` getter, set `beatmap.colors.comboColors` on the input map before loading it or constructing the renderer instead.

## Usage

Load the bundled Torus font CSS before rendering if you want combo numbers to match the default renderer:

```ts
import "osu-beatmap-preview/assets/fonts/torus.css";
```

```ts
import {StandardBeatmapPreviewer} from "osu-beatmap-preview";

const canvas = document.querySelector("canvas")!;
const preview = new StandardBeatmapPreviewer(canvas, {
  width: 640,
  height: 480,
});

const osuText = await fetch(`https://osu.ppy.sh/osu/${beatmapId}`).then((response) => response.text());

preview.loadBeatmapText(osuText, {
  mods: 0,
});

preview.render(42_000);
```

## API

- `new StandardBeatmapPreviewer(canvas, options?)`
- `loadBeatmapText(osuText, options?)`
- `loadBeatmap(beatmap, options?)`
- `loadPreparedBeatmap(beatmap, options?)`
- `render(timeMs)`
- `resize(width, height, devicePixelRatio?)`
- `clear()`
- `dispose()`
- `beatmap`

The standard preview fits and centers its 640 × 480 logical playfield within the requested canvas size. `resize` updates the drawing buffer using the device pixel ratio and preserves the playfield's aspect ratio, including in the demo's fullscreen mode.

The renderer accepts an existing `HTMLCanvasElement`. It does not query the DOM, fetch beatmaps, manage playback time, or provide UI controls.

Both renderers select overlapping hitobject intervals before drawing. Slider body rasters use a per-renderer LRU cache limited to 16,777,216 pixels (64 MiB of nominal RGBA storage) and 256 entries, plus one shared scratch surface for individual rasters larger than that budget. Unchanged bodies reuse their pixels; geometry, appearance, clipping, and resolution changes invalidate them. Resizing, replacing a map, or disposing a view releases its cached surfaces. Direct renderer users should also call `dispose()` when finished.

### Sharing a prepared beatmap

Both previewers work independently with `loadBeatmapText()` or `loadBeatmap()`. When using multiple views, prepare the map once with the optional loader and attach the same result to each view:

```ts
import {BeatmapLoader} from "osu-beatmap-preview";
const loader = new BeatmapLoader();
const prepared = loader.loadBeatmapText(osuText, {mods: 0});
preview.loadPreparedBeatmap(prepared);
timeline.loadPreparedBeatmap(prepared);
```

`BeatmapLoader` prepares osu!standard maps without creating a canvas. Its `loadBeatmap(beatmap, {mods})` method accepts a decoded map or a prepared handle. Preparation operates on a clone of the original decoded source so mods cannot mutate another attached map. Replacing mods starts from that source.

`loadPreparedBeatmap()` attaches the exact handle without repeating preparation and accepts only the per-view `useBeatmapPreviewTime` option. Resizing, zooming, playback offsets, appearance, and raster resources belong to each view. Disposing one view does not dispose the shared map or another view, even when direct renderers share a canvas context.

Treat `prepared.beatmap` and its nested data as read-only while attached. To change mods or geometry, prepare and attach a new handle. The dependency populates internal geometry caches lazily, so nested models are not deep-frozen. Handles themselves are frozen and cannot be constructed, copied, or subclassed by consumers.

Externally converted maps must retain an unmodified `base` to replace mods correctly. The loader cannot recover geometry already changed by an external conversion.

### Timeline preview

Use a second canvas to show nearby hitobjects with the current playback time at the center:

```ts
import {StandardTimelinePreviewer} from "osu-beatmap-preview";

const timelineCanvas = document.querySelector<HTMLCanvasElement>("#hitobject-timeline")!;
const timeline = new StandardTimelinePreviewer(timelineCanvas, {
  width: 640,
  height: 46,
  timeRange: 4000,
  beatSnapDivisor: 4, // Show quarter-beat subdivisions.
  objectRadius: 16, // Hitobject radius in logical canvas pixels.
});

timeline.loadBeatmapText(osuText, {mods: 0});
let currentTimeMs = 42_000;
const durationMs = timeline.beatmap!.totalLength;

function render(timeMs: number) {
  preview.render(timeMs);
  timeline.render(timeMs);
}

timeline.zoom(2); // Zoom in around the current time: show 2 seconds.
timeline.beatSnapDivisor = 8; // Switch to eighth-beat subdivisions.
render(currentTimeMs);

// Seek to a clicked position, accounting for CSS scaling of the canvas.
timelineCanvas.addEventListener("click", (event) => {
  const bounds = timelineCanvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width * 640;
  const nextTime = timeline.timeAtPosition(x, currentTimeMs);
  currentTimeMs = Math.max(0, Math.min(nextTime, durationMs));
  render(currentTimeMs);
});
```

`StandardTimelinePreviewer` supports the same loading, rendering, resizing, and lifecycle methods as `StandardBeatmapPreviewer`. Pass the same load options and playback time to both views. An existing decoded beatmap can also be passed to `loadBeatmap(beatmap, options?)`.

- `timeRange`: visible duration in playback milliseconds, default `4000`, clamped to `250`–`60000`. Assign a positive finite number to change it.
- `beatSnapDivisor`: ruler subdivisions per beat, default `4`. Accepts integers from `1` to `16` in the constructor or as a property; `3` gives triplets and `4` gives quarter beats. This changes the ruler grid; seeking remains continuous.
- `zoom(factor)`: factors above `1` zoom in; factors below `1` zoom out. The factor must be positive and finite.
- `objectRadius`: hitobject radius in logical canvas pixels, default `16`. Accepts positive finite numbers in the constructor or as a property. Heads, bodies, combo numbers, and slider markers scale together. Use `resize` to provide enough canvas height for larger objects.
- `timeAtPosition(x, currentTimeMs)`: converts a logical canvas x coordinate to playback time. The center always returns `currentTimeMs`, including with clock-rate mods or preview-time offsets.

The ruler follows the beatmap's timing points: ticks align to each timing offset and BPM, with stronger marks for beats and measures using the active time signature. BPM and meter changes take effect at their timing points. Clock-rate mods and preview-time offsets keep the ruler aligned with the hitobjects. When zoomed out, subdivisions that would overlap are hidden while the remaining marks stay aligned to beats or measures.

Tick colors and height ratios follow osu!lazer's [beat divisor styles](https://github.com/ppy/osu/blob/master/osu.Game/Screens/Edit/BindableBeatDivisor.cs), scaled to a 10 px maximum height. Bar downbeats are 2 px wide at 100% height; all other ticks are 1 px wide. Beats and halves use 90% height, thirds and quarters 80%, sixths and eighths 70%, and remaining subdivisions 60%. All ticks remain bottom-aligned.

Call `render(timeMs)` after zooming, resizing, or changing `beatSnapDivisor` or `objectRadius`. Scroll by changing the playback time supplied to `render`; wheel, drag, keyboard events, and time bounds remain in the consuming application. Nearby objects remain visible independently of approach rate or Hidden, so the timeline can be used to inspect patterns. Sliders and spinners span their full durations, including when their heads are outside the view.

For direct canvas integration, `StandardTimelineRenderer` and its `TimelineViewport` are also exported. Call `renderer.resize(width, height)` with logical dimensions when the canvas size changes.

## Development

### Prerequisites

- Node.js 20.19 or newer (Node.js 22.12+ is also supported).
- npm.

### Setup

```bash
git clone https://github.com/dotremilie/osu-beatmap-preview.git
cd osu-beatmap-preview
npm install
```

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

### Interactive demo

Start the local renderer demo:

```bash
npm run demo
```

Open the URL printed by Vite (normally `http://localhost:5173`). The demo includes playback controls, a hitobject timeline, the repository's Renatus, Aspire, and Net0 showcase maps, and an **Open .osu** button for previewing a local beatmap file. Drag or scroll the hitobject timeline to seek; use the zoom buttons or Ctrl/⌘ + scroll to zoom. Choose **Beat snap** to change ruler subdivisions from `1/1` through `1/16`, including triplets. A focused timeline also supports arrow keys, Home/End, and +/−.

To create a production build of the demo:

```bash
npm run demo:build
```

The static output is written to `demo-dist/`.

## Acknowledgements

- [osu!](https://osu.ppy.sh/)
- [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview)
- kionell's [osu-parsers](https://github.com/kionell/osu-parsers), [osu-classes](https://github.com/kionell/osu-classes), and related libraries.
