import {HitObject} from "osu-classes";
import type Drawable from "./Drawable";

/**
 * Abstract class representing a drawable hit object.
 *
 * @template T - The type of the hit object, extending {@link HitObject}.
 */
export default abstract class DrawableHitObject<THitObject extends HitObject> implements Drawable {
    hitObject: THitObject;

    /**
     * Creates a new drawable hit object.
     *
     * @param hitObject - The hit object to draw.
     */
    constructor(hitObject: THitObject) {
        this.hitObject = hitObject;
    }

    /**
     * Calculates the opacity of the hit object at a given time.
     *
     * @param time - The current time in milliseconds.
     * @returns The opacity of the hit object.
     */
    abstract opacity(time: number): number;

    /**
     * Draws the hit object on the canvas.
     *
     * @param ctx - The canvas rendering context.
     * @param time - The current time in milliseconds.
     */
    abstract draw(ctx: CanvasRenderingContext2D, time: number): void;

    /**
     * Calculates the scale of the hit object at a given time.
     *
     * @param time - The current time in milliseconds.
     * @returns The scale factor of the hit object.
     */
    abstract scale(time: number): number;

}
