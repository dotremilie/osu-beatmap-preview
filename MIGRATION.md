# Migration guide

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
- `resize()` requires positive finite dimensions and DPR. Identical resizes preserve slider path buffers.
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
