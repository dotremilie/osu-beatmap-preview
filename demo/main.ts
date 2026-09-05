import "../assets/fonts/torus.css";
import "./style.css";
import {BeatmapLoader, StandardBeatmapPreviewer, StandardTimelinePreviewer} from "../src";
import {StandardRuleset} from "osu-standard-stable";
import renatus from "./beatmaps/Renatus.osu?raw";
import aspire from "./beatmaps/aspire.osu?raw";
import neto from "./beatmaps/neto.osu?raw";

const SHOWCASE_BEATMAPS = {
    renatus: {text: renatus, label: "Renatus"},
    aspire: {text: aspire, label: "Aspire"},
    neto: {text: neto, label: "Net0"},
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

const beatmapLoader = new BeatmapLoader(new StandardRuleset());
const preview = new StandardBeatmapPreviewer(canvas, {
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

let duration = 1;
let position = 0;
let playing = true;
let previousFrame = performance.now();
let timelineDrag: {
    pointerId: number;
    startX: number;
    position: number;
    millisecondsPerPixel: number;
    playing: boolean;
    moved: boolean;
} | null = null;

loadShowcase("renatus");
requestAnimationFrame(frame);

playButton.addEventListener("click", togglePlayback);
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
});
document.addEventListener("fullscreenchange", () => {
    const fullscreen = document.fullscreenElement === previewStage;
    fullscreenButton.textContent = fullscreen ? "Exit fullscreen" : "Fullscreen";
    fullscreenButton.setAttribute("aria-pressed", String(fullscreen));
    resizePreview();
});
new ResizeObserver(resizePreview).observe(previewStage);
window.addEventListener("resize", resizePreview);
restartButton.addEventListener("click", () => {
    finishTimelineDrag();
    playing = true;
    seek(0);
});

positionSlider.addEventListener("input", () => {
    seek(Number(positionSlider.value));
});

zoomInButton.addEventListener("click", () => zoomTimeline(1.5));
zoomOutButton.addEventListener("click", () => zoomTimeline(1 / 1.5));
beatSnapSelect.addEventListener("change", () => {
    timelinePreview.beatSnapDivisor = Number(beatSnapSelect.value);
    render();
});
timelineCanvas.addEventListener("wheel", scrollTimeline, {passive: false});
objectRadiusInput.addEventListener("input", () => {
    const radius = objectRadiusInput.valueAsNumber;
    if (!Number.isFinite(radius) || !objectRadiusInput.validity.valid) return;

    timelinePreview.objectRadius = radius;
    timelinePreview.resize(TIMELINE_WIDTH, Math.ceil(radius * 2 + 14), Math.min(globalThis.devicePixelRatio ?? 1, 2));
    render();
});
timelineCanvas.addEventListener("pointerdown", startTimelineDrag);
timelineCanvas.addEventListener("pointermove", moveTimelineDrag);
timelineCanvas.addEventListener("pointerup", (event) => {
    if (timelineDrag?.pointerId !== event.pointerId) return;

    if (!timelineDrag.moved) {
        const bounds = timelineCanvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * TIMELINE_WIDTH;
        seek(timelinePreview.timeAtPosition(x, position));
    }

    finishTimelineDrag();
});
timelineCanvas.addEventListener("pointercancel", (event) => {
    if (timelineDrag?.pointerId === event.pointerId) finishTimelineDrag();
});
timelineCanvas.addEventListener("lostpointercapture", (event) => {
    if (timelineDrag?.pointerId === event.pointerId) finishTimelineDrag();
});
timelineCanvas.addEventListener("keydown", navigateTimeline);

beatmapSelect.addEventListener("change", () => {
    loadShowcase(beatmapSelect.value as ShowcaseBeatmap);
});

fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    try {
        loadBeatmap(await file.text(), `Loaded ${file.name}`);
    } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not load that beatmap";
        status.dataset.error = "true";
    } finally {
        fileInput.value = "";
    }
});

document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement
        || event.target instanceof HTMLTextAreaElement
        || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;

    event.preventDefault();
    togglePlayback();
});

function resizePreview(): void {
    const fullscreen = document.fullscreenElement === previewStage;
    const width = fullscreen ? previewStage.clientWidth : Math.min(previewStage.clientWidth, 800);
    const height = fullscreen ? previewStage.clientHeight : width * 3 / 4;
    const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    if (width <= 0 || height <= 0) return;
    if (canvas.style.width === `${width}px` && canvas.style.height === `${height}px`
        && canvas.width === Math.round(width * pixelRatio) && canvas.height === Math.round(height * pixelRatio)) return;

    preview.resize(width, height, pixelRatio);
    render();
}

function loadBeatmap(text: string, message: string): void {
    const beatmap = beatmapLoader.loadBeatmapText(text);
    preview.loadPreparedBeatmap(beatmap);
    const hitObjects = beatmap.hitObjects;

    finishTimelineDrag();
    timelinePreview.loadPreparedBeatmap(beatmap);
    duration = Math.max(1, beatmap.totalLength);
    const previewTime = beatmap.general.previewTime;
    playing = true;
    positionSlider.max = String(duration);
    timelineCanvas.setAttribute("aria-valuemax", String(duration));
    title.textContent = beatmap.metadata.title || "Untitled beatmap";
    artist.textContent = [beatmap.metadata.artist, beatmap.metadata.version].filter(Boolean).join(" · ");
    status.textContent = `${message} · ${hitObjects.length} objects`;
    delete status.dataset.error;
    seek(previewTime >= 0 ? previewTime : hitObjects[0]?.startTime ?? 0);
}

function loadShowcase(key: ShowcaseBeatmap): void {
    const beatmap = SHOWCASE_BEATMAPS[key];
    beatmapSelect.value = key;
    loadBeatmap(beatmap.text, `Loaded ${beatmap.label} showcase`);
}

function frame(now: number): void {
    if (playing) {
        position += now - previousFrame;

        if (position >= duration) {
            position = 0;
        }

        render();
    }

    previousFrame = now;
    requestAnimationFrame(frame);
}

function togglePlayback(): void {
    finishTimelineDrag();
    playing = !playing;
    previousFrame = performance.now();
    render();
}

function seek(time: number): void {
    position = Math.max(0, Math.min(time, duration));
    previousFrame = performance.now();
    render();
}

function render(): void {
    preview.render(position);
    timelinePreview.render(position);
    syncControls();
}

function zoomTimeline(factor: number): void {
    timelinePreview.zoom(factor);
    render();
}

function scrollTimeline(event: WheelEvent): void {
    event.preventDefault();
    if (timelineDrag) return;

    const width = timelineCanvas.getBoundingClientRect().width;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const pixels = delta * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? width : 1);

    if (event.ctrlKey || event.metaKey) {
        zoomTimeline(Math.exp(-Math.max(-500, Math.min(500, pixels)) * 0.002));
    } else {
        seek(position + pixels / width * timelinePreview.timeRange);
    }
}

function startTimelineDrag(event: PointerEvent): void {
    if (event.button !== 0 || timelineDrag) return;

    timelineDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        position,
        millisecondsPerPixel: timelinePreview.timeRange / timelineCanvas.getBoundingClientRect().width,
        playing,
        moved: false,
    };
    playing = false;
    timelineCanvas.setPointerCapture(event.pointerId);
    timelineCanvas.focus({preventScroll: true});
    timelineCanvas.dataset.dragging = "true";
    event.preventDefault();
    syncControls();
}

function moveTimelineDrag(event: PointerEvent): void {
    if (timelineDrag?.pointerId !== event.pointerId) return;

    const distance = event.clientX - timelineDrag.startX;
    if (Math.abs(distance) > 3) timelineDrag.moved = true;
    if (!timelineDrag.moved) return;

    seek(timelineDrag.position - distance * timelineDrag.millisecondsPerPixel);
}

function finishTimelineDrag(): void {
    if (!timelineDrag) return;

    const {pointerId, playing: wasPlaying} = timelineDrag;
    timelineDrag = null;
    playing = wasPlaying;
    previousFrame = performance.now();
    delete timelineCanvas.dataset.dragging;

    if (timelineCanvas.hasPointerCapture(pointerId)) timelineCanvas.releasePointerCapture(pointerId);
    syncControls();
}

function navigateTimeline(event: KeyboardEvent): void {
    const step = timelinePreview.timeRange / (event.shiftKey ? 4 : 20);

    switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown": seek(position - step); break;
        case "ArrowRight":
        case "ArrowUp": seek(position + step); break;
        case "Home": seek(0); break;
        case "End": seek(duration); break;
        case "+":
        case "=": zoomTimeline(1.5); break;
        case "-": zoomTimeline(1 / 1.5); break;
        default: return;
    }

    event.preventDefault();
}

function syncControls(): void {
    positionSlider.value = String(Math.round(position));
    positionSlider.style.setProperty("--progress", `${position / duration * 100}%`);
    timelineCanvas.setAttribute("aria-valuenow", String(Math.round(position)));
    timelineCanvas.setAttribute("aria-valuetext", formatTime(position));
    zoomInButton.disabled = timelinePreview.timeRange <= 250;
    zoomOutButton.disabled = timelinePreview.timeRange >= 60_000;
    currentTime.textContent = formatTime(position);
    durationLabel.textContent = formatTime(duration);
    playButton.dataset.playing = String(playing);
    playButton.setAttribute("aria-label", playing ? "Pause preview" : "Play preview");
    playButton.textContent = playing ? "Pause" : "Play";
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
