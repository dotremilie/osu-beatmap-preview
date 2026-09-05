import MathUtils from "./MathUtils";

export interface TimelineOptions {
    /** Visible duration in playback milliseconds, clamped to 250–60,000. */
    timeRange?: number;
    /** Number of ruler subdivisions per beat, from 1 to 16. Defaults to 4. */
    beatSnapDivisor?: number;
    /** Hitobject radius in logical canvas pixels. Defaults to 16. */
    objectRadius?: number;
}

/** Maps playback time to a centered, zoomable horizontal view. */
export default class TimelineViewport {
    private range = 4000;
    private divisor = 4;
    private radius = 16;

    constructor(options: TimelineOptions = {}) {
        this.timeRange = options.timeRange ?? this.range;
        this.beatSnapDivisor = options.beatSnapDivisor ?? this.divisor;
        this.objectRadius = options.objectRadius ?? this.radius;
    }

    public get objectRadius(): number {
        return this.radius;
    }

    public set objectRadius(value: number) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new RangeError("Timeline object radius must be a positive finite number");
        }

        this.radius = value;
    }

    public get beatSnapDivisor(): number {
        return this.divisor;
    }

    public set beatSnapDivisor(value: number) {
        if (!Number.isInteger(value) || value < 1 || value > 16) {
            throw new RangeError("Timeline beat snap divisor must be an integer from 1 to 16");
        }

        this.divisor = value;
    }

    public get timeRange(): number {
        return this.range;
    }

    public set timeRange(value: number) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new RangeError("Timeline time range must be a positive finite number");
        }

        this.range = MathUtils.clamp(value, 250, 60_000);
    }

    /** A factor greater than one zooms in, keeping the current time centered. */
    public zoom(factor: number): void {
        if (!Number.isFinite(factor) || factor <= 0) {
            throw new RangeError("Timeline zoom factor must be a positive finite number");
        }

        this.timeRange = MathUtils.clamp(this.range / factor, 250, 60_000);
    }

    public positionAtTime(time: number, currentTime: number, width: number): number {
        return width / 2 + (time - currentTime) / this.range * width;
    }

    public timeAtPosition(x: number, currentTime: number, width: number): number {
        return currentTime + (x / width - 0.5) * this.range;
    }
}
