# Changelog

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
