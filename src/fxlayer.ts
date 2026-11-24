// @ts-nocheck
import { createFrame, clearFrame, createFx, composite } from './pfx/core/index.js';
import * as hitSpark from './pfx/fx/impacts/hit-spark.js';
import * as critHit from './pfx/fx/impacts/crit-hit.js';
import * as poof from './pfx/fx/spawn/poof.js';
import * as healAoe from './pfx/fx/holy/heal-aoe.js';

const MODS = { hit: hitSpark, death: poof, boss: critHit, heal: healAoe };
const MAX = 14;
export class FxLayer {
    constructor(w, h) {
        this.w = w; this.h = h; this.frame = createFrame(w, h); this.img = new ImageData(w, h);
        this.off = document.createElement('canvas'); this.off.width = w; this.off.height = h; this.octx = this.off.getContext('2d'); this.list = [];
    }
    add(ev) {
        if (this.list.length >= MAX) this.list.shift();
        this.list.push(createFx(MODS[ev.k], { x: ev.x, y: ev.y, flip: ev.flip, seed: (Math.random() * 1e6) | 0 }));
    }
    clear() { this.list = []; }
    update(dt) { for (const f of this.list) f.update(dt / 1000); this.list = this.list.filter((f) => !f.done()); }
    draw(ctx) {
        if (!this.list.length) return;
        clearFrame(this.frame);
        for (const f of this.list) f.draw(this.frame, 'back');
        for (const f of this.list) f.draw(this.frame, 'front');
        composite(this.frame, this.img.data, null);
        this.octx.putImageData(this.img, 0, 0);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(this.off, 0, 0);
    }
}
