import { SHEETS, META } from './sheets';

export type Role = '전열' | '딜러' | '원거리' | '지원';
export type Rarity = 0 | 1 | 2;
export const RARITY_NAME = ['일반', '희귀', '영웅'];
export const RARITY_MULT = [1, 1.35, 1.8];
export const RARITY_COLOR = ['#8a8a8a', '#3b7dd8', '#c9892b'];
export const MAX_LV = 3, MAX_ENH = 5;
export function unitMult(u: { rarity: Rarity; lv: number; enh: number }) { return RARITY_MULT[u.rarity] * (1 + 0.6 * (u.lv - 1)) * (1 + 0.08 * u.enh); }
export function enhCost(u: { enh: number }) { return 2 + u.enh * 2; }
export function shardValue(u: { rarity: Rarity; lv: number }) { return [1, 2, 4][u.rarity] * u.lv; }
export const LV_HUE = [0, 0, 55, 130];

export interface UnitDef {
    id: string; sheet: string; name: string; role: Role;
    hp: number; atk: number; cd: number; range: number; face: number; // face: 1 sprite looks right
    ranged?: 'spear' | 'orb'; heal?: number; px: number; // target visible px height
    desc: string;
}

export const ALLIES: UnitDef[] = [
    { id: 'knight', sheet: 'hk', name: 'Hero Knight', role: '전열', hp: 260, atk: 14, cd: 1000, range: 54, face: 1, px: 50, desc: '맨 앞에서 버티는 기사' },
    { id: 'warrior', sheet: 'fw', name: 'Fantasy Warrior', role: '전열', hp: 210, atk: 20, cd: 900, range: 54, face: 1, px: 48, desc: '체력과 공격이 균형 잡힌 전사' },
    { id: 'martial', sheet: 'mh', name: 'Martial Hero', role: '딜러', hp: 150, atk: 30, cd: 800, range: 54, face: 1, px: 52, desc: '근접 고화력 딜러' },
    { id: 'huntress', sheet: 'hu', name: 'Huntress', role: '원거리', hp: 120, atk: 22, cd: 900, range: 200, face: 1, ranged: 'spear', px: 46, desc: '창을 던지는 원거리' },
    { id: 'wizard', sheet: 'wz', name: 'Wizard', role: '지원', hp: 110, atk: 10, cd: 1400, range: 200, face: 1, ranged: 'orb', heal: 26, px: 50, desc: '아군을 치유하는 지원' },
];

export interface EnemyDef {
    id: string; sheet: string; name: string; hp: number; atk: number; cd: number; speed: number; range: number;
    px: number; flying?: boolean; boss?: boolean; face: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
    goblin: { id: 'goblin', sheet: 'go', name: 'Goblin', hp: 45, atk: 8, cd: 800, speed: 40, range: 34, px: 38, face: 1 },
    mushroom: { id: 'mushroom', sheet: 'mu', name: 'Mushroom', hp: 110, atk: 12, cd: 1400, speed: 20, range: 34, px: 40, face: 1 },
    skeleton: { id: 'skeleton', sheet: 'sk', name: 'Skeleton', hp: 75, atk: 10, cd: 1100, speed: 24, range: 40, px: 48, face: 1 },
    eye: { id: 'eye', sheet: 'fe', name: 'Flying Eye', hp: 40, atk: 7, cd: 900, speed: 34, range: 34, px: 34, flying: true, face: 1 },
    worm: { id: 'worm', sheet: 'fwm', name: 'Fire Worm', hp: 900, atk: 26, cd: 1500, speed: 14, range: 46, px: 64, boss: true, face: 1 },
    wizardBoss: { id: 'wizardBoss', sheet: 'ew', name: 'Evil Wizard', hp: 1200, atk: 34, cd: 1500, speed: 18, range: 60, px: 72, boss: true, face: 1 },
};

export interface RegionDef { id: number; name: string; pool: string[]; elite: string; boss: string; bg: 'forest' | 'grotto' | 'none'; ready: boolean; need: string; }
export const REGIONS: RegionDef[] = [
    { id: 1, name: '숲', pool: ['goblin', 'mushroom', 'eye'], elite: 'mushroom', boss: 'worm', bg: 'forest', ready: true, need: '' },
    { id: 2, name: '동굴', pool: ['skeleton', 'goblin', 'eye'], elite: 'skeleton', boss: 'wizardBoss', bg: 'grotto', ready: true, need: '' },
    { id: 3, name: '늪과 폐허', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '보스 Demon Slime 사용 조건 확인과 배경 VISTA 확인 필요' },
    { id: 4, name: '설원', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '배경과 적 확보 필요' },
    { id: 5, name: '심연', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '보스 Cthulu와 배경 확보 필요' },
    { id: 6, name: '미궁', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '보스와 배경 확보 필요' },
    { id: 7, name: '화염 지대', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '보스, 적, 배경 확보 필요' },
    { id: 8, name: '최종 지역', pool: [], elite: '', boss: '', bg: 'none', ready: false, need: '보스, 적, 배경 확보 필요' },
];
export const STAGES_PER_REGION = 7; // 일반 5 + 정예 1 + 보스 1

export interface StageDef { region: number; index: number; kind: '일반' | '정예' | '보스'; label: string; spawns: { id: string; at: number }[]; mult: number; reward: number; }

export function buildStage(region: RegionDef, index: number): StageDef {
    const kind: StageDef['kind'] = index === STAGES_PER_REGION - 1 ? '보스' : index === STAGES_PER_REGION - 2 ? '정예' : '일반';
    const global = (region.id - 1) * STAGES_PER_REGION + index;
    const mult = 1 + global * 0.2 + (kind === '보스' ? 0.4 : 0);
    const spawns: { id: string; at: number }[] = [];
    const n = 6 + Math.floor(index * 1.5) + (region.id - 1) * 2;
    let t = 1200;
    for (let i = 0; i < n; i++) {
        spawns.push({ id: region.pool[(i + index) % region.pool.length], at: t });
        t += 1500 - Math.min(700, index * 80 + (region.id - 1) * 120);
    }
    if (kind === '정예') { spawns.push({ id: region.elite, at: t + 800 }); spawns.push({ id: region.elite, at: t + 1600 }); }
    if (kind === '보스') spawns.push({ id: region.boss, at: t + 1500 });
    return { region: region.id, index, kind, label: `${region.id}-${index + 1}`, spawns, mult: kind === '정예' ? mult * 1.08 : mult, reward: 5 + index + (kind === '보스' ? 10 : 0) };
}

// ---------- runtime ----------
export interface Unit {
    uid: number; def: UnitDef; rarity: Rarity; cell: number; lv: number; enh: number;
}

export interface Fighter {
    team: 'a' | 'e'; key: string; sheet: string; x: number; y: number; baseX: number;
    hp: number; maxHp: number; atk: number; cd: number; range: number; speed: number; px: number; face: number;
    state: 'idle' | 'move' | 'atk' | 'hit' | 'die'; t: number; fired: boolean; cdLeft: number; target: Fighter | null;
    ranged?: 'spear' | 'orb'; heal?: number; flying?: boolean; boss?: boolean; dead: boolean; fade: number; hitT: number; role?: Role; lv?: number;
    name: string;
}
export interface Proj { x: number; y: number; target: Fighter; dmg: number; kind: 'spear' | 'orb'; from: 'a' | 'e'; heal?: boolean; }
export interface Float { x: number; y: number; text: string; color: string; t: number; }
export interface Battle {
    fighters: Fighter[]; projs: Proj[]; floats: Float[]; time: number; spawned: number; stage: StageDef;
    result: null | 'win' | 'lose'; kills: number; total: number;
    events?: { k: 'hit' | 'death' | 'boss' | 'heal'; x: number; y: number; flip: boolean }[];
}

export const W = 360, H = 250;
export const CELL_X = [42, 94, 146];
export const CELL_Y = [150, 184, 218];
export function cellPos(cell: number) { return { x: CELL_X[cell % 3], y: CELL_Y[Math.floor(cell / 3)] }; }

export function synergy(units: Unit[]) {
    const c: Record<string, number> = {};
    units.forEach((u) => { c[u.def.role] = (c[u.def.role] || 0) + 1; });
    return c;
}
export function synergyBonus(count: number) { return count >= 3 ? 0.25 : count >= 2 ? 0.1 : 0; }

export function startBattle(board: Unit[], stage: StageDef): Battle {
    const syn = synergy(board);
    const fighters: Fighter[] = board.map((u) => {
        const m = unitMult(u) * (1 + synergyBonus(syn[u.def.role] || 0));
        const p = cellPos(u.cell);
        return {
            team: 'a', key: `a${u.uid}`, sheet: u.def.sheet, x: p.x, y: p.y, baseX: p.x, hp: Math.round(u.def.hp * m), maxHp: Math.round(u.def.hp * m), atk: u.def.atk * m, cd: u.def.cd, range: u.def.range,
            speed: 0, px: u.def.px, face: 1, state: 'idle', t: Math.random() * 600, fired: false, cdLeft: 300 + Math.random() * 400, target: null, ranged: u.def.ranged, heal: u.def.heal ? u.def.heal * m : undefined,
            dead: false, fade: 1, hitT: 0, role: u.def.role, name: u.def.name, lv: u.lv,
        };
    });
    return { fighters, projs: [], floats: [], time: 0, spawned: 0, stage, result: null, kills: 0, total: stage.spawns.length };
}

function spawnEnemy(b: Battle, id: string) {
    const d = ENEMIES[id];
    const lane = Math.floor(Math.random() * 3);
    const y = d.flying ? CELL_Y[lane] - 26 : CELL_Y[lane];
    const m = b.stage.mult;
    b.fighters.push({
        team: 'e', key: `e${b.fighters.length}_${Math.random()}`, sheet: d.sheet, x: W + 30, y, baseX: W + 30, hp: Math.round(d.hp * m), maxHp: Math.round(d.hp * m), atk: d.atk * (1 + (m - 1) * 0.75), cd: d.cd,
        range: d.range, speed: d.speed, px: d.px, face: -1, state: 'move', t: 0, fired: false, cdLeft: 400, target: null, flying: d.flying, boss: d.boss, dead: false, fade: 1, hitT: 0, name: d.name,
    });
}

const ATK_MS = 560;
const HIT_MS = 260;

function damage(b: Battle, f: Fighter, dmg: number) {
    if (f.dead) return;
    f.hp -= dmg;
    b.events?.push({ k: 'hit', x: f.x, y: f.y - f.px * 0.5, flip: f.team === 'e' });
    b.floats.push({ x: f.x, y: f.y - f.px - 4, text: String(Math.round(dmg)), color: f.team === 'e' ? '#fff3b0' : '#ff9a8a', t: 0 });
    if (f.hp <= 0) { f.dead = true; f.state = 'die'; f.t = 0; if (f.team === 'e') b.kills++; b.events?.push({ k: f.boss ? 'boss' : 'death', x: f.x, y: f.y - 4, flip: false }); }
    else if (f.state !== 'atk') { f.state = 'hit'; f.t = 0; }
}

export function step(b: Battle, dt: number) {
    if (b.result) { b.time += dt; b.fighters.forEach((f) => { f.t += dt; }); return; }
    b.time += dt;
    const sp = b.stage.spawns;
    while (b.spawned < sp.length && sp[b.spawned].at <= b.time) { spawnEnemy(b, sp[b.spawned].id); b.spawned++; }
    const allies = b.fighters.filter((f) => f.team === 'a' && !f.dead);
    const enemies = b.fighters.filter((f) => f.team === 'e' && !f.dead);
    for (const f of b.fighters) {
        f.t += dt;
        if (f.dead) { f.fade = Math.max(0, f.fade - dt / 2200); continue; }
        if (f.hitT > 0) f.hitT -= dt;
        const foes = f.team === 'a' ? enemies : allies;
        // pick target: nearest foe
        let tgt: Fighter | null = null; let bd = 1e9;
        for (const o of foes) { const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.5; if (d < bd) { bd = d; tgt = o; } }
        f.target = tgt;
        if (f.state === 'hit') { if (f.t > HIT_MS) { f.state = 'idle'; f.t = 0; } continue; }
        if (f.state === 'atk') {
            if (!f.fired && f.t > ATK_MS * 0.55) {
                f.fired = true;
                if (f.heal) {
                    const hurt = allies.filter((a) => a.hp < a.maxHp).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
                    if (hurt && hurt.hp / hurt.maxHp < 0.85) { b.projs.push({ x: f.x, y: f.y - f.px * 0.6, target: hurt, dmg: f.heal, kind: 'orb', from: 'a', heal: true }); }
                    else if (f.target) b.projs.push({ x: f.x, y: f.y - f.px * 0.6, target: f.target, dmg: f.atk, kind: 'orb', from: 'a' });
                } else if (f.target) {
                    if (f.ranged) b.projs.push({ x: f.x, y: f.y - f.px * 0.6, target: f.target, dmg: f.atk, kind: f.ranged, from: f.team });
                    else damage(b, f.target, f.atk);
                }
            }
            if (f.t > ATK_MS) { f.state = 'idle'; f.t = 0; f.cdLeft = f.cd - ATK_MS; }
            continue;
        }
        f.cdLeft -= dt;
        const reach = (o: Fighter) => Math.abs(o.x - f.x) <= f.range + 6;
        const canHeal = f.heal && allies.some((a) => a.hp / a.maxHp < 0.85);
        if (f.team === 'a') {
            if ((tgt && reach(tgt)) || canHeal) { if (f.cdLeft <= 0) { f.state = 'atk'; f.t = 0; f.fired = false; } else if (f.state !== 'idle') { f.state = 'idle'; } }
        } else {
            if (tgt && Math.abs(tgt.x - f.x) <= f.range) {
                if (f.cdLeft <= 0) { f.state = 'atk'; f.t = 0; f.fired = false; } else f.state = 'idle';
            } else { f.state = 'move'; f.x -= (f.speed * dt) / 1000; }
        }
    }
    // projectiles
    for (const p of b.projs) {
        const tx = p.target.x, ty = p.target.y - p.target.px * 0.5;
        const dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; const v = 340 * dt / 1000;
        if (d <= v + 4 || p.target.dead) { (p as Proj & { done?: boolean }).done = true; if (!p.target.dead) { if (p.heal) { p.target.hp = Math.min(p.target.maxHp, p.target.hp + p.dmg); b.events?.push({ k: 'heal', x: p.target.x, y: p.target.y - 4, flip: false }); b.floats.push({ x: p.target.x, y: p.target.y - p.target.px - 4, text: '+' + Math.round(p.dmg), color: '#9be39a', t: 0 }); } else damage(b, p.target, p.dmg); } }
        else { p.x += (dx / d) * v; p.y += (dy / d) * v; }
    }
    b.projs = b.projs.filter((p) => !(p as Proj & { done?: boolean }).done);
    for (const fl of b.floats) { fl.t += dt; fl.y -= dt * 0.025; }
    b.floats = b.floats.filter((fl) => fl.t < 900);
    // end checks
    const aliveE = b.fighters.some((f) => f.team === 'e' && !f.dead);
    const aliveA = b.fighters.some((f) => f.team === 'a' && !f.dead);
    if (!aliveA) b.result = 'lose';
    else if (b.spawned >= sp.length && !aliveE) b.result = 'win';
    if (aliveA === true) {
        // enemies that walked past the left edge hit the base: treat as reaching allies; clamp
        for (const f of b.fighters) if (f.team === 'e' && !f.dead && f.x < 20) f.x = 20;
    }
}

// ---------- drawing ----------
const imgCache: Record<string, HTMLImageElement> = {};
export function allUrls(): string[] { const u: string[] = []; Object.values(SHEETS).forEach((s) => Object.values(s).forEach((x) => u.push(x))); return Array.from(new Set(u)); }
export function registerImg(url: string, el: HTMLImageElement) { imgCache[url] = el; }
export function loadStats() { const v = Object.values(imgCache); return `${v.filter((i) => i.naturalWidth > 0).length}/${v.length}`; }
export function sheetFor(sheet: string, anim: string): { img: HTMLImageElement; frames: number } | null {
    const s = SHEETS[sheet]; const url = s[anim] || (anim === 'move' ? s.idle : undefined) || s.idle; const img = imgCache[url]; const m = META[sheet];
    if (!img || !img.naturalWidth) return null;
    const iw = img.naturalWidth;
    return { img, frames: Math.max(1, Math.round(iw / m.fw)) };
}

export function drawSprite(ctx: CanvasRenderingContext2D, sheet: string, anim: string, t: number, x: number, y: number, px: number, flip: boolean, loop: boolean, alpha = 1, tint = 0, hue = 0) {
    const sf = sheetFor(sheet, anim); if (!sf) return;
    const m = META[sheet]; const scale = px / m.h;
    const fps = anim === 'idle' ? 8 : anim === 'die' ? 9 : 14;
    let f = Math.floor((t / 1000) * fps);
    f = loop ? f % sf.frames : Math.min(sf.frames - 1, f);
    if (anim === 'atk') f = Math.min(sf.frames - 1, Math.floor((t / ATK_MS) * sf.frames));
    if (anim === 'hit') f = Math.min(sf.frames - 1, Math.floor((t / HIT_MS) * sf.frames));
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    if (hue) ctx.filter = `hue-rotate(${hue}deg) saturate(1.25)`;
    ctx.drawImage(sf.img, f * m.fw, 0, m.fw, m.fh, -m.cx * scale, -m.fy * scale, m.fw * scale, m.fh * scale);
    if (tint > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${tint})`; ctx.fillRect(-m.cx * scale, -m.fy * scale, m.fw * scale, m.fh * scale); }
    ctx.restore();
}

export function drawBattle(ctx: CanvasRenderingContext2D, b: Battle | null, board: Unit[], bg: HTMLImageElement | null, regionBg: string, selectedCell: number | null) {
    ctx.imageSmoothingEnabled = false;
    // background
    if (regionBg === 'grotto' && bg && bg.naturalWidth) {
        const sc = H / bg.naturalHeight; ctx.drawImage(bg, 0, 0, bg.naturalWidth, bg.naturalHeight, -40, 0, bg.naturalWidth * sc, H);
        ctx.fillStyle = 'rgba(10,10,20,0.15)'; ctx.fillRect(0, 0, W, H);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d2a2b'); g.addColorStop(0.6, '#2c4435'); g.addColorStop(1, '#1b2b20');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#16221a'; for (let i = 0; i < 9; i++) { const x = i * 58 - 10; ctx.fillRect(x, 40 + (i % 3) * 10, 14, 110); ctx.beginPath(); ctx.arc(x + 7, 40 + (i % 3) * 10, 32, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#2b3a22'; ctx.fillRect(0, 138, W, H - 138);
        ctx.fillStyle = '#3a4a2c'; ctx.fillRect(0, 138, W, 4);
    }
    // grid cells
    for (let c = 0; c < 9; c++) {
        const p = cellPos(c); ctx.strokeStyle = selectedCell === c ? '#ffe28a' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = selectedCell === c ? 2 : 1;
        ctx.strokeRect(p.x - 22, p.y - 12, 44, 18);
    }
    const list: { y: number; draw: () => void }[] = [];
    if (!b) {
        board.forEach((u) => { const p = cellPos(u.cell); list.push({ y: p.y, draw: () => { drawLvAura(ctx, p.x, p.y, u.lv); drawSprite(ctx, u.def.sheet, 'idle', performance.now(), p.x, p.y, u.def.px * (1 + 0.06 * (u.lv - 1)), false, true, 1, 0, LV_HUE[u.lv]); drawRarity(ctx, p.x, p.y, u.rarity, u.lv); } }); });
    } else {
        for (const f of b.fighters) {
            list.push({ y: f.y, draw: () => {
                const anim = f.state === 'move' ? 'move' : f.state;
                const loop = f.state === 'idle' || f.state === 'move';
                if (f.team === 'a') drawLvAura(ctx, f.x, f.y, f.lv || 1);
                drawSprite(ctx, f.sheet, anim, f.t, f.x, f.y, f.px * (f.team === 'a' ? 1 + 0.06 * ((f.lv || 1) - 1) : 1), f.team === 'e', loop, f.dead ? f.fade : 1, 0, f.team === 'a' ? LV_HUE[f.lv || 1] : 0);
                if (!f.dead) {
                    const w = f.boss ? 50 : 30; const hx = f.x - w / 2; const hy = f.y - f.px - 10;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(hx - 1, hy - 1, w + 2, 5);
                    ctx.fillStyle = f.team === 'a' ? '#5fd16a' : '#e0584a'; ctx.fillRect(hx, hy, w * Math.max(0, f.hp / f.maxHp), 3);
                }
            } });
        }
    }
    list.sort((p, q) => p.y - q.y).forEach((i) => i.draw());
    if (b) {
        for (const p of b.projs) {
            if (p.kind === 'spear') { ctx.fillStyle = '#e9d9a6'; ctx.fillRect(p.x - 7, p.y - 1, 14, 2); ctx.fillStyle = '#fff'; ctx.fillRect(p.x + 5, p.y - 2, 3, 4); }
            else { ctx.fillStyle = p.heal ? '#8df0a0' : '#c9a2ff'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 1.6, 0, 7); ctx.fill(); }
        }
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        for (const fl of b.floats) { ctx.globalAlpha = 1 - fl.t / 900; ctx.fillStyle = '#000'; ctx.fillText(fl.text, fl.x + 1, fl.y + 1); ctx.fillStyle = fl.color; ctx.fillText(fl.text, fl.x, fl.y); ctx.globalAlpha = 1; }
    }
}
function drawRarity(ctx: CanvasRenderingContext2D, x: number, y: number, r: Rarity, lv = 1) {
    ctx.fillStyle = RARITY_COLOR[r]; ctx.fillRect(x - 10, y + 3, 20, 3);
    ctx.fillStyle = '#ffe28a'; for (let i = 0; i < lv; i++) ctx.fillRect(x - 10 + i * 7, y + 7, 5, 3);
}
function drawLvAura(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number) {
    if (lv < 2) return;
    const tt = performance.now() / 400; const r = 15 + Math.sin(tt) * 2;
    ctx.save(); ctx.globalAlpha = lv === 2 ? 0.28 : 0.4; ctx.fillStyle = lv === 2 ? '#7ad7ff' : '#ffd36a'; ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.35, 0, 0, 7); ctx.fill(); ctx.restore();
}

export function iconDraw(canvas: HTMLCanvasElement, sheet: string, px = 40) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSprite(ctx, sheet, 'idle', 0, canvas.width / 2, canvas.height - 4, px, false, true);
}

export function rollRarity(): Rarity { const r = Math.random(); return r < 0.05 ? 2 : r < 0.3 ? 1 : 0; }
export function rollUnit(): UnitDef {
    const w = [24, 22, 22, 18, 14]; const tot = w.reduce((a, b) => a + b, 0); let r = Math.random() * tot;
    for (let i = 0; i < ALLIES.length; i++) { r -= w[i]; if (r <= 0) return ALLIES[i]; }
    return ALLIES[0];
}
