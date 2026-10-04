# Changelog

## Unreleased

### Added

- Built-in Argon follow points behind standard hitobjects, respecting combo boundaries, stacked slider endpoints, clock-rate mods, and arbitrary seeking.
- Optional `cursorTrail` setting on standard playfield previewers and renderers, with a separate demo toggle.
- Opt-in Argon autoplay cursor and bounded trail for standard playfield views, with runtime toggling and deterministic seeking. Enable with `autoplay: true`; the demo enables it by default.

### Breaking changes

- Standard-specific `BeatmapLoader` no longer accepts an injected ruleset. Loading returns an opaque `PreparedBeatmap` with read-only `beatmap` and `clockRate` properties.
- Prepared-map attachment and direct renderer constructors require authentic library handles. Direct renderer `getBeatmap` is renamed to `beatmap`.
- Canvas resizing rejects non-positive or non-finite dimensions and device pixel ratios.

### Changed

- Separate canvas lifecycle, preparation, projections, animation evaluation, and procedural appearance; construct complete drawable collections without virtual initialization from base constructors.
- Move timeline composition into an internal ruleset-neutral renderer. Extension contracts remain internal.
- Own raster caches and appearance independently per renderer; restore nested canvas state on painting errors and preserve resources across identical resizes.
- Coalesce demo updates into one frame scheduler, skip hidden fullscreen timelines, update stable controls on state changes, and lazy-load showcase maps with stale-request protection and explicit teardown.

### Fixed

- Match Argon's cursor trail with small white additive stamps, spatial interpolation, and its skin-specific fade exponent.
- Bound ruler density across timing-point changes and search directly for the first visible timing segment.
- Skip invisible circle and approach-circle drawing work.
- Release failed raster surfaces and prevent disposed direct renderers from reallocating resources.

See the README migration guide for examples. Version and release metadata are unchanged.

## 0.3.0 - 2026-09-05

### Breaking changes

- Renamed the public `StandardBeatmapPreview` export to `StandardBeatmapPreviewer` and `StandardRenderer` to `StandardBeatmapRenderer`.
- Renamed the `PlayfieldOffset` type to `Offset` and the `BeatmapPreviewOptions.playfieldOffset` option to `offset`.
- Removed the renderer's protected `DEFAULT_COLORS` getter. Supply custom combo colors through `beatmap.colors.comboColors` before loading or rendering the map.
- Standard previews now scale and center the 640 × 480 logical playfield to fit the canvas, preserving its aspect ratio. Custom offsets are applied in logical playfield coordinates before scaling.

See the [migration guide](README.md#migrating-from-020) for updated imports and options.

### Added

- `StandardTimelinePreviewer`, `StandardTimelineRenderer`, and `TimelineViewport` for a centered hitobject timeline with zoom, configurable object sizes, and a timing-aligned beat ruler.
- Timeline seeking, zoom controls, beat subdivisions, keyboard navigation, and fullscreen playfield resizing in the interactive demo.
- A ruleset-agnostic `BeatmapLoader` and `loadPreparedBeatmap()` on both previewers to share one prepared beatmap across independent views.
- Argon-style spinner disc, rotating ticks, side progress arcs, centre rings, and glow, with deterministic animations for seeking.

### Changed

- Select visible hitobjects through an interval index and reuse slider body rasters through a bounded per-canvas cache.
- Release renderer caches when resizing, replacing a beatmap, or disposing a view. Direct renderer users should call `dispose()` when finished.

### Fixed

- Center combo numbers using measured text bounds.
- Clip slider raster bounds to the visible canvas and account for playfield scaling and device pixel ratio when allocating rendering surfaces.
- Isolate beatmap preparation from its source and restart from the original decoded map when replacing mods, preventing shared geometry mutation and compounded mod effects.
- Use fallback combo colors without mutating the shared beatmap.
- Keep spinners visible for their full fade-out, including the longer Hidden fade.
- Update the locked development dependencies `nanoid` to `3.3.18` and `postcss` to `8.5.28` to resolve dependency audit findings.

## 0.2.0 - 2026-07-22

### Added

- Argon-style slider repeats and score-point ticks based on ppy/osu rendering behavior.
- Argon slider ball and follow circle with directional, entrance, exit, and tick-pulse animations.
- Interactive renderer demo with bundled showcase beatmaps, playback controls, timeline seeking, and local `.osu` file loading.
- Slider renderer tests covering paths, repeats, ticks, and the slider ball.

### Changed

- Separated slider path rendering from the slider body and corrected the end-cap geometry.
- Made the Argon Pro slider body translucent so the playfield remains visible through it.
- Updated `osu-standard-stable`, TypeScript, and Vite to their current releases.
- Raised the development requirement to Node.js 20.19 or newer.
