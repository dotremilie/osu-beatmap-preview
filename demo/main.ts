import "../assets/fonts/torus.css";
import "./style.css";
import {BeatmapLoader, StandardBeatmapPreviewer, StandardTimelinePreviewer} from "../src";
import PlaybackController from "./PlaybackController";
import TimelineInteraction from "./TimelineInteraction";
import {renderPreviewFrame} from "./PreviewFrame";
import LatestBeatmapLoad from "./LatestBeatmapLoad";

const SHOWCASE_BEATMAPS = {
    renatus: {load: () => import("./beatmaps/Renatus.osu?raw").then(module => module.default), label: "Renatus"},
    aspire: {load: () => import("./beatmaps/aspire.osu?raw").then(module => module.default), label: "Aspire"},
    neto: {load: () => import("./beatmaps/neto.osu?raw").then(module => module.default), label: "Net0"},
} as const;

type ShowcaseBeatmap = keyof typeof SHOWCASE_BEATMAPS;

const TIMELINE_WIDTH = 640;

const canvas = getElement<HTMLCanvasElement>("preview");
const previewStage = getElement<HTMLElement>("preview-stage");
const fullscreenButton = getElement<HTMLButtonElement>("fullscreen");
const timelineCanvas = getElement<HTMLCanvasElement>("hitobject-timeline");
const playButton = getElement<HTMLButtonElement>("play");
const restartButton = getElement<HTMLButtonElement>("restart");
const positionSlider = getElement<HTMLInputElement>("timeline");
const zoomInButton = getElement<HTMLButtonElement>("zoom-in");
const zoomOutButton = getElement<HTMLButtonElement>("zoom-out");
const beatSnapSelect = getElement<HTMLSelectElement>("beat-snap");
const objectRadiusInput = getElement<HTMLInputElement>("object-radius");
const currentTime = getElement<HTMLElement>("current-time");
const durationLabel = getElement<HTMLElement>("duration");
const title = getElement<HTMLElement>("title");
const artist = getElement<HTMLElement>("artist");
const status = getElement<HTMLElement>("status");
const fileInput = getElement<HTMLInputElement>("beatmap-file");
const beatmapSelect = getElement<HTMLSelectElement>("beatmap-select");

const autoplayCheckbox = getElement<HTMLInputElement>("autoplay");
const cursorTrailCheckbox = getElement<HTMLInputElement>("cursor-trail");

const beatmapLoader = new BeatmapLoader();
const preview = new StandardBeatmapPreviewer(canvas, {
    autoplay: true,
    width: 640,
    height: 480,
    devicePixelRatio: Math.min(globalThis.devicePixelRatio ?? 1, 2),
});

const timelinePreview = new StandardTimelinePreviewer(timelineCanvas, {
    width: TIMELINE_WIDTH,
    height: 46,
    timeRange: 4000,
    beatSnapDivisor: Number(beatSnapSelect.value),
    objectRadius: objectRadiusInput.valueAsNumber,
    devicePixelRatio: Math.min(globalThis.devicePixelRatio ?? 1, 2),
});

const events = new AbortController();
const loadRequest = new LatestBeatmapLoad();
let displayedDuration: number | undefined;
let displayedPlaying: boolean | undefined;
const playback = new PlaybackController(render, syncPlaybackControls);
const timelineInput = new TimelineInteraction(timelineCanvas, timelinePreview, playback, TIMELINE_WIDTH, syncZoomControls);
syncPlaybackControls();
syncZoomControls();
void loadShowcase("renatus");

autoplayCheckbox.addEventListener("change", () => {
    preview.autoplay = autoplayCheckbox.checked;
    playback.invalidate();
}, {signal: events.signal});
cursorTrailCheckbox.addEventListener("change", () => {
    preview.cursorTrail = cursorTrailCheckbox.checked;
    playback.invalidate();
}, {signal: events.signal});
playButton.addEventListener("click", togglePlayback, {signal: events.signal});
fullscreenButton.disabled = !document.fullscreenEnabled;
fullscreenButton.addEventListener("click", async () => {
    try {
        if (document.fullscreenElement === previewStage) {
            await document.exitFullscreen();
        } else {
            await previewStage.requestFullscreen();
        }
    } catch {
        status.textContent = "Could not change fullscreen mode";
        status.dataset.error = "true";
    }
}, {signal: events.signal});
document.addEventListener("fullscreenchange", () => {
    const fullscreen = document.fullscreenElement === previewStage;
    fullscreenButton.textContent = fullscreen ? "Exit fullscreen" : "Fullscreen";
    fullscreenButton.setAttribute("aria-pressed", String(fullscreen));
    resizePreview();
    playback.invalidate();
}, {signal: events.signal});
let resizePending = false;
const resizeObserver = new ResizeObserver(() => {
    resizePending = true;
    playback.invalidate();
});
resizeObserver.observe(previewStage);
window.addEventListener("resize", resizePreview, {signal: events.signal});
restartButton.addEventListener("click", () => {
    timelineInput.finish();
    playback.setPlaying(true);
    playback.seek(0);
}, {signal: events.signal});

positionSlider.addEventListener("input", () => {
    playback.seek(Number(positionSlider.value));
}, {signal: events.signal});

zoomInButton.addEventListener("click", () => timelineInput.zoom(1.5), {signal: events.signal});
zoomOutButton.addEventListener("click", () => timelineInput.zoom(1 / 1.5), {signal: events.signal});
beatSnapSelect.addEventListener("change", () => {
    timelinePreview.beatSnapDivisor = Number(beatSnapSelect.value);
    playback.invalidate();
}, {signal: events.signal});
objectRadiusInput.addEventListener("input", () => {
    const radius = objectRadiusInput.valueAsNumber;
    if (!Number.isFinite(radius) || !objectRadiusInput.validity.valid) return;

    timelinePreview.objectRadius = radius;
    timelinePreview.resize(TIMELINE_WIDTH, Math.ceil(radius * 2 + 14), Math.min(globalThis.devicePixelRatio ?? 1, 2));
    playback.invalidate();
}, {signal: events.signal});

beatmapSelect.addEventListener("change", () => {
    loadShowcase(beatmapSelect.value as ShowcaseBeatmap);
}, {signal: events.signal});

fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileInput.value = "";
    void loadRequest.run(() => file.text(), text => loadBeatmap(text, `Loaded ${file.name}`), showLoadError);
}, {signal: events.signal});

document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement
        || event.target instanceof HTMLTextAreaElement
        || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;

    event.preventDefault();
    togglePlayback();
}, {signal: events.signal});

function resizePreview(): void {
    const fullscreen = document.fullscreenElement === previewStage;
    const width = fullscreen ? previewStage.clientWidth : Math.min(previewStage.clientWidth, 800);
    const height = fullscreen ? previewStage.clientHeight : width * 3 / 4;
    const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    if (width <= 0 || height <= 0) return;
    if (canvas.style.width === `${width}px` && canvas.style.height === `${height}px`
        && canvas.width === Math.round(width * pixelRatio) && canvas.height === Math.round(height * pixelRatio)) return;

    preview.resize(width, height, pixelRatio);
    playback.invalidate();
}

function loadBeatmap(text: string, message: string): void {
    const prepared = beatmapLoader.loadBeatmapText(text);
    const beatmap = prepared.beatmap;
    preview.loadPreparedBeatmap(prepared);
    const hitObjects = beatmap.hitObjects;

    timelineInput.finish();
    timelinePreview.loadPreparedBeatmap(prepared);
    const duration = Math.max(1, beatmap.totalLength);
    const previewTime = beatmap.general.previewTime;
    positionSlider.max = String(duration);
    timelineCanvas.setAttribute("aria-valuemax", String(duration));
    title.textContent = beatmap.metadata.title || "Untitled beatmap";
    artist.textContent = [beatmap.metadata.artist, beatmap.metadata.version].filter(Boolean).join(" · ");
    status.textContent = `${message} · ${hitObjects.length} objects`;
    delete status.dataset.error;
    playback.load(duration, previewTime >= 0 ? previewTime : hitObjects[0]?.startTime ?? 0);
}

async function loadShowcase(key: ShowcaseBeatmap): Promise<void> {
    const beatmap = SHOWCASE_BEATMAPS[key];
    await loadRequest.run(beatmap.load, text => {
        loadBeatmap(text, `Loaded ${beatmap.label} showcase`);
        beatmapSelect.value = key;
    }, showLoadError);
}

function showLoadError(error: unknown): void {
    status.textContent = error instanceof Error ? error.message : "Could not load that beatmap";
    status.dataset.error = "true";
}

function togglePlayback(): void {
    timelineInput.finish();
    playback.setPlaying(!playback.playing);
}

function render(): void {
    if (resizePending) {
        resizePending = false;
        resizePreview();
    }
    renderPreviewFrame(preview, timelinePreview, playback.position, document.fullscreenElement === previewStage);
    syncPositionControls();
}

function syncZoomControls(): void {
    zoomInButton.disabled = timelinePreview.timeRange <= 250;
    zoomOutButton.disabled = timelinePreview.timeRange >= 60_000;
}

function syncPlaybackControls(): void {
    if (displayedDuration !== playback.duration) {
        displayedDuration = playback.duration;
        durationLabel.textContent = formatTime(playback.duration);
    }
    if (displayedPlaying !== playback.playing) {
        displayedPlaying = playback.playing;
        playButton.dataset.playing = String(playback.playing);
        playButton.setAttribute("aria-label", playback.playing ? "Pause preview" : "Play preview");
        playButton.textContent = playback.playing ? "Pause" : "Play";
    }
}

function syncPositionControls(): void {
    const position = playback.position;
    positionSlider.value = String(Math.round(position));
    positionSlider.style.setProperty("--progress", `${position / playback.duration * 100}%`);
    timelineCanvas.setAttribute("aria-valuenow", String(Math.round(position)));
    timelineCanvas.setAttribute("aria-valuetext", formatTime(position));
    currentTime.textContent = formatTime(position);
}

function formatTime(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / 60_000);
    const seconds = Math.floor(milliseconds % 60_000 / 1000);
    const millis = Math.floor(milliseconds % 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);

    if (!element) throw new Error(`Missing #${id}`);

    return element as T;
}

function dispose(): void {
    events.abort();
    resizeObserver.disconnect();
    loadRequest.dispose();
    timelineInput.dispose();
    playback.dispose();
    preview.dispose();
    timelinePreview.dispose();
}
window.addEventListener("pagehide", dispose, {once: true, signal: events.signal});
if (import.meta.hot) import.meta.hot.dispose(dispose);
