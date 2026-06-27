import {DrawableManiaHitObject} from "./DrawableManiaHitObject";
import {Hold, Note} from "osu-mania-stable";
import {Color4} from "osu-classes";

export class DrawableNote extends DrawableManiaHitObject<Note> {
    color: Color4;

    constructor(hitObject: Note, color: Color4) {
        super(hitObject);
        this.color = color;
    }

    draw(ctx: CanvasRenderingContext2D, time: number): void {
        throw new Error("Method not implemented.");
    }
}
