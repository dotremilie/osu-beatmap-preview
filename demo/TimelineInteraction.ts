import type {StandardTimelinePreviewer} from "../src";
import type PlaybackController from "./PlaybackController";

interface TimelineDrag {
    pointerId: number;
    startX: number;
    position: number;
    millisecondsPerPixel: number;
    playing: boolean;
    moved: boolean;
}

/** Owns timeline pointer, wheel and keyboard interactions and their cleanup. */
export default class TimelineInteraction {
    private drag: TimelineDrag | null = null;
    private readonly events = new AbortController();

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly timeline: StandardTimelinePreviewer,
        private readonly playback: PlaybackController,
        private readonly logicalWidth: number,
        private readonly zoomChanged: () => void,
    ) {
        const signal = this.events.signal;
        canvas.addEventListener("pointerdown", this.start, {signal});
        canvas.addEventListener("pointermove", this.move, {signal});
        canvas.addEventListener("pointerup", this.end, {signal});
        canvas.addEventListener("pointercancel", this.cancel, {signal});
        canvas.addEventListener("lostpointercapture", this.cancel, {signal});
        canvas.addEventListener("wheel", this.wheel, {passive: false, signal});
        canvas.addEventListener("keydown", this.key, {signal});
    }

    public zoom(factor: number): void {
        this.timeline.zoom(factor);
        this.zoomChanged();
        this.playback.invalidate();
    }

    public finish(): void {
        if (!this.drag) return;
        const {pointerId, playing} = this.drag;
        this.drag = null;
        delete this.canvas.dataset.dragging;
        if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
        this.playback.setPlaying(playing);
    }

    public dispose(): void {
        this.finish();
        this.events.abort();
    }

    private readonly start = (event: PointerEvent): void => {
        if (event.button !== 0 || this.drag) return;
        const width = this.canvas.getBoundingClientRect().width;
        if (width <= 0) return;
        this.drag = {
            pointerId: event.pointerId, startX: event.clientX, position: this.playback.position,
            millisecondsPerPixel: this.timeline.timeRange / width, playing: this.playback.playing, moved: false,
        };
        this.playback.setPlaying(false);
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.focus({preventScroll: true});
        this.canvas.dataset.dragging = "true";
        event.preventDefault();
    };

    private readonly move = (event: PointerEvent): void => {
        if (this.drag?.pointerId !== event.pointerId) return;
        const distance = event.clientX - this.drag.startX;
        if (Math.abs(distance) > 3) this.drag.moved = true;
        if (this.drag.moved) this.playback.seek(this.drag.position - distance * this.drag.millisecondsPerPixel);
    };

    private readonly end = (event: PointerEvent): void => {
        if (this.drag?.pointerId !== event.pointerId) return;
        if (!this.drag.moved) {
            const bounds = this.canvas.getBoundingClientRect();
            if (bounds.width > 0) {
                const x = (event.clientX - bounds.left) / bounds.width * this.logicalWidth;
                this.playback.seek(this.timeline.timeAtPosition(x, this.playback.position));
            }
        }
        this.finish();
    };

    private readonly cancel = (event: PointerEvent): void => {
        if (this.drag?.pointerId === event.pointerId) this.finish();
    };

    private readonly wheel = (event: WheelEvent): void => {
        event.preventDefault();
        if (this.drag) return;
        const width = this.canvas.getBoundingClientRect().width;
        if (width <= 0) return;
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        const pixels = delta * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? width : 1);
        if (event.ctrlKey || event.metaKey) this.zoom(Math.exp(-Math.max(-500, Math.min(500, pixels)) * 0.002));
        else this.playback.seek(this.playback.position + pixels / width * this.timeline.timeRange);
    };

    private readonly key = (event: KeyboardEvent): void => {
        const step = this.timeline.timeRange / (event.shiftKey ? 4 : 20);
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown": this.playback.seek(this.playback.position - step); break;
            case "ArrowRight":
            case "ArrowUp": this.playback.seek(this.playback.position + step); break;
            case "Home": this.playback.seek(0); break;
            case "End": this.playback.seek(this.playback.duration); break;
            case "+":
            case "=": this.zoom(1.5); break;
            case "-": this.zoom(1 / 1.5); break;
            default: return;
        }
        event.preventDefault();
    };
}
