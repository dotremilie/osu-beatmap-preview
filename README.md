<div align="center">
  <img src="assets/logo-128.png" width="128" height="128" alt="osu! Beatmap Preview Library logo">
  <h1>osu! Beatmap Preview Library</h1>
  <p>Lightweight HTML canvas previews for osu!standard beatmaps.</p>
  <p>
    <a href="https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/ci.yml"><img src="https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI status"></a>
    <a href="https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/publish.yml"><img src="https://github.com/dotremilie/osu-beatmap-preview/actions/workflows/publish.yml/badge.svg?event=release" alt="npm publishing status"></a>
    <a href="https://www.npmjs.com/package/osu-beatmap-preview"><img src="https://img.shields.io/npm/v/osu-beatmap-preview" alt="npm version"></a>
  </p>
  <p>
    <a href="https://www.npmjs.com/package/osu-beatmap-preview">npm</a>
    ·
    <a href="https://github.com/dotremilie/osu-beatmap-preview/releases/latest">Latest release</a>
  </p>
</div>

Render osu!standard beatmaps in a browser with no UI framework dependency. The library uses `osu-parsers`, `osu-classes`, and `osu-standard-stable` for beatmap handling; your application controls fetching, audio, and playback time.

## Features

- Argon-style playfield objects, including sliders, spinners, and animated follow points. Complex Bézier and Catmull slider paths are supported.
- Optional autoplay cursor and trail.
- Timeline preview with a beat ruler, zoom, and seeking.
- Combo colors, mods, and prepared beatmaps that can be shared across independent views.
- Bundled Torus font assets for combo numbers.

## Installation

```bash
npm install osu-beatmap-preview
```

## Quick start

```ts
import {StandardBeatmapPreviewer} from "osu-beatmap-preview";
import "osu-beatmap-preview/assets/fonts/torus.css";

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const preview = new StandardBeatmapPreviewer(canvas, {width: 640, height: 480});
const osuText = await fetch("/map.osu").then(response => response.text());

preview.loadBeatmapText(osuText);
preview.render(42_000); // Playback time in milliseconds.

// Call preview.dispose() when finished.
```

Call `render(timeMs)` whenever the playback time changes. For autoplay, a shared beatmap with a timeline, and direct renderer use, see the usage guide.

## Documentation

- [Usage and API](USAGE.md) — autoplay cursor, prepared beatmaps, timeline, and renderer details.
- [Migration guide](MIGRATION.md) — changes from 0.2.0 and 0.3.0.
- [Development guide](DEVELOPMENT.md) — setup, checks, and the interactive demo.
- [Changelog](CHANGELOG.md) and [roadmap](ROADMAP.md).

## Acknowledgements

- [osu!](https://osu.ppy.sh/)
- [JerryZhu99/osu-preview](https://github.com/JerryZhu99/osu-preview)
- kionell's [osu-parsers](https://github.com/kionell/osu-parsers), [osu-classes](https://github.com/kionell/osu-classes), and related libraries.
