import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalState } from '@instinct/files';
import { FxLayer } from './fxlayer';
import { drawSymbol } from './icons';
import grotto from './photos/grotto.jpg';
import bgforest from './photos/forest.jpg';
import bgcanopy from './photos/canopy.jpg';
import bgtundra from './photos/tundra.jpg';
import bghollow from './photos/hollow.jpg';
import bgmesa from './photos/mesa.jpg';
import bgkiln from './photos/kiln.jpg';
import bgsodium from './photos/sodium.jpg';
import fontRegular from './fonts/Galmuri11.woff2';
import fontBold from './fonts/Galmuri11-Bold.woff2';
const BG_SRC: Record<string, string> = { grotto, forest: bgforest, canopy: bgcanopy, tundra: bgtundra, hollow: bghollow, mesa: bgmesa, kiln: bgkiln, sodium: bgsodium };
import {
    ALLIES, MAX_UNITS, lineSurge, GRID_LINES, MAX_ROSTER, PROMOS2, PROMO2_DESC, REGIONS, RARITY_NAME, RARITY_COLOR, STAGES_PER_REGION, W, H, MAX_LV, MAX_ENH, STAR_AT, IMP_SLOTS, starOf, absFromStar, CORES, MAX_CORES, rollCores, addAllyToBattle, lineSurge, GIMMICKS, UPS, MAX_UP_STACK, rollUps, buildStage, cellPos, drawBattle, drawSprite, iconDraw, allUrls, registerImg,
    rollRarity, rollUnit, startBattle, step, synergy, synergyBonus, unitMult, enhCost, shardValue, type Battle, type Unit,
  assignCells, optimizeFormation, unitPower, ENGRAVINGS, MAX_ENG, PROMOS, PROMO_DESC, engIndexOf, unitHp, unitAtk, unitHeal, CELL_X, evalGrid, rollCell, rollSymbolUnit, SYMBOLS, LINE_SUMMON, SPECIAL_SHARDS, type GridCell,
} from './game';

const SUMMON_COST = 1; // 기본. 웨이브 안에서 스핀할수록 오름(우리 설계, 임시)
const NUDGE_PER_WAVE = 1; // 원작: 웨이브당 1회(영상 자막). 동작 방식은 우리 설계
const REROLL_COST = 1;
const MAX_BOARD = MAX_UNITS;
let uidSeq = 1;
const ROLES = ['전열', '딜러', '원거리', '지원'] as const;

function absorbCalc(t: Unit, src: Unit): { t2: Unit; gain: number; note: string; abs: number } {
    const gv = (r: number) => r + 1;
    const ei = engIndexOf(src.def.role); const eng = (t.eng || [0, 0, 0, 0]).slice();
    let gain = 1 + Math.floor((src.abs || 1) / 3);
    (src.eng || []).forEach((l) => { if (l > 0) gain += gv(src.rarity) + l - 1; });
    let note = '';
    if (eng[ei] > 0 && eng[ei] < MAX_ENG) { eng[ei]++; note = `각인 ${ENGRAVINGS[ei].name} ${eng[ei]}단계`; }
    else if (eng[ei] === 0 && eng.filter((x) => x > 0).length < IMP_SLOTS[t.rarity]) { eng[ei] = 1; note = `각인 ${ENGRAVINGS[ei].name} 1단계`; }
    else { gain += gv(src.rarity); note = '각인 칸이 차서 흡수 레벨로 전환'; }
    const abs = (t.abs || 1) + gain; const lv = Math.max(t.lv, starOf(t.rarity, abs));
    return { t2: { ...t, eng, abs, lv }, gain, note, abs };
}
function Icon({ sheet, ready, lv = 1 }: { sheet: string; ready: boolean; lv?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => { if (ref.current && ready) iconDraw(ref.current, sheet, 38); }, [sheet, ready, lv]);
    return <canvas ref={ref} width={52} height={46} className="sb-icon" />;
}

function SymIcon({ sym }: { sym: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => { if (ref.current) drawSymbol(ref.current, SYMBOLS[sym].id); }, [sym]);
    return <canvas ref={ref} width={36} height={36} className="sb-icon" />;
}

function mergeAll(list: Unit[]): { list: Unit[]; merged: string[] } {
    let cur = list.slice(); const merged: string[] = [];
    for (let guard = 0; guard < 20; guard++) {
        let did = false;
        for (const d of ALLIES) for (const r of [0, 1, 2]) for (let lv = 1; lv < MAX_LV; lv++) {
            const g = cur.filter((u) => u.def.id === d.id && u.rarity === r && u.lv === lv);
            if (g.length >= 3) {
                g.sort((a, b) => b.cell - a.cell);
                const keep = g[0]; const rm = new Set([g[0].uid, g[1].uid, g[2].uid]);
                const enh = Math.max(g[0].enh, g[1].enh, g[2].enh);
                cur = cur.filter((u) => !rm.has(u.uid)); cur.push({ ...keep, uid: uidSeq++, lv: lv + 1, enh });
                merged.push(`${d.name} Lv${lv + 1}`); did = true; break;
            }
        }
        if (!did) break;
    }
    return { list: cur, merged };
}

export function App() {
    const [ready, setReady] = useState(false);
    const [coins, setCoins] = useState(12);
    const [shards, setShards] = useState(0);
    const [units, setUnits] = useState<Unit[]>([]);
    const [region, setRegion] = useState(0);
    const [stageIdx, setStageIdx] = useState(0);
    const [cleared, setCleared] = useState<Record<string, boolean>>({});
    const [cores, setCores] = useState<string[]>([]); const coresRef = useRef<string[]>([]); coresRef.current = cores;
    const [offer, setOffer] = useState<string[] | null>(null);
    const lootApplied = useRef(0);
    const [ups, setUps] = useState<string[]>([]); const upsRef = useRef<string[]>([]); upsRef.current = ups; const [upOffer, setUpOffer] = useState<string[] | null>(null);
    const [sel, setSel] = useState<number | null>(null);
    const hoverRef = useRef<number | null>(null);
    const flashCellRef = useRef<{ cell: number; until: number } | null>(null);
    const [phase, setPhase] = useState<'prep' | 'battle' | 'win' | 'lose'>('prep');
    const [grid, setGrid] = useState<GridCell[] | null>(null);
    const [view, setView] = useState<GridCell[] | null>(null);
    const [pend, setPend] = useState<{ grid: GridCell[]; rerolled: boolean } | null>(null);
    const [held, setHeld] = useState<boolean[]>([false, false, false]);
    const [spinning, setSpinning] = useState(false);
    const [flash, setFlash] = useState(false);
    const [msg, setMsg] = useState('소환해서 유닛을 모으세요');
    const [kills, setKills] = useState<[number, number]>([0, 0]);
    const [map, setMap] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [undo, setUndo] = useState<Unit[] | null>(null);
    const fxRef = useRef<FxLayer | null>(null); if (!fxRef.current && typeof document !== 'undefined') fxRef.current = new FxLayer(W, H);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const battleRef = useRef<Battle | null>(null);
    const bgsRef = useRef<Record<string, HTMLImageElement>>({});
    const unitsRef = useRef<Unit[]>([]); unitsRef.current = units;
    const phaseRef = useRef(phase); phaseRef.current = phase;
    const regionRef = useRef(region); regionRef.current = region;
    const urls = useRef(allUrls()).current;
    const [loadProg, setLoadProg] = useState(0);
    const [loadError, setLoadError] = useState(false);
    // 에셋 로더: 동시 요청을 제한하고 실패 시 지수 백오프로 재시도한다.
    // (이전: 숨겨진 <img> 150개 동시 요청 + onError 미처리 → 하나라도 실패하면 영구 '불러오는 중')
    useEffect(() => {
        let cancelled = false;
        const jobs: { key: string; src: string; bg?: string; font?: string }[] = [
            { key: 'font:400', src: fontRegular, font: '400' },
            { key: 'font:700', src: fontBold, font: '700' },
            ...urls.map((u) => ({ key: u, src: u })),
            ...Object.entries(BG_SRC).map(([k, src]) => ({ key: `bg:${k}`, src, bg: k })),
        ];
        const total = jobs.length;
        let idx = 0; let done = 0; let failed = 0;
        const loadOne = (job: { key: string; src: string; bg?: string; font?: string }) => new Promise<void>((resolve) => {
            let attempt = 0;
            const tryLoad = () => {
                if (cancelled) return resolve();
                // 호스트가 <img> 직접 요청을 간헐 거부하는 문제가 있어 fetch→blob URL로 로드한다.
                fetch(job.src).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then((blob) => {
                    if (cancelled) return resolve();
                    if (job.font) {
                        // 폰트는 FontFace로 등록(CSS url()은 빌드 제약으로 사용 불가)
                        blob.arrayBuffer().then((buf) => {
                            const face = new FontFace('Galmuri11', buf, { weight: job.font });
                            return face.load().then((f) => { document.fonts.add(f); });
                        }).then(() => { done += 1; if (!cancelled) setLoadProg(done); resolve(); }).catch(() => retry());
                        return;
                    }
                    const ou = URL.createObjectURL(blob);
                    const el = new Image();
                    el.onload = () => {
                        if (job.bg) bgsRef.current[job.bg] = el; else registerImg(job.src, el);
                        done += 1; if (!cancelled) setLoadProg(done); resolve();
                    };
                    el.onerror = () => { URL.revokeObjectURL(ou); retry(); };
                    el.src = ou;
                }).catch(() => retry());
            };
            const retry = () => {
                attempt += 1;
                if (attempt <= 6) { setTimeout(tryLoad, 400 * attempt + Math.random() * 200); }
                else { failed += 1; done += 1; if (!cancelled) { setLoadProg(done); setLoadError(true); } resolve(); }
            };
            tryLoad();
        });
        const POOL = 8;
        const workers = Array.from({ length: POOL }, async () => { while (idx < jobs.length) { await loadOne(jobs[idx++]); } });
        Promise.all(workers).then(() => { if (!cancelled && failed === 0) setReady(true); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [save, setSave, saved] = useLocalState<{ coins: number; shards: number; units: number[][]; region: number; stage: number; cleared: Record<string, boolean>; cores?: string[]; ups?: string[]; pend?: { g: number[][]; rr: boolean } | null } | null>('slotbound.save.v1', null);
    const restored = useRef(false); const [loaded, setLoaded] = useState(false); // 복원 상태가 반영된 렌더부터만 자동 저장(복원 직전 빈 상태가 저장을 덮는 틈 방지)
    useEffect(() => {
        if (!saved.ready || restored.current) return; restored.current = true;
        if (save) {
            const us: Unit[] = save.units.map((q) => ({ uid: uidSeq++, def: ALLIES[q[0]], rarity: q[1] as 0 | 1 | 2, lv: q[2], enh: q[3], cell: q[4], promo: q[5] || 0, eng: [q[6] || 0, q[7] || 0, q[8] || 0, q[9] || 0], abs: q[10] || absFromStar(q[1], q[2]), off: q[11] === 1, promo2: q[12] || 0 })).filter((u) => u.def);
            setUnits(((l: Unit[]) => { let n = 0; return l.map((u) => (u.off ? u : ++n <= MAX_UNITS ? u : { ...u, off: true })); })(us)); setCoins(save.coins); setShards(save.shards); setRegion(Math.min(save.region, REGIONS.length - 1)); setStageIdx(save.stage); setCleared(save.cleared || {});
            { const sv = save as unknown as { cores?: string[]; ups?: string[] }; if (Array.isArray(sv.cores)) setCores(sv.cores.filter((x) => CORES.some((c) => c.id === x)).slice(0, MAX_CORES)); if (Array.isArray(sv.ups)) setUps(sv.ups.filter((x) => UPS.some((d) => d.id === x)).slice(0, 40)); }
            if (save.pend && save.pend.g.length === 9) { const pg = save.pend.g.map((q) => ({ u: q[0] })); if (pg.every((c) => SYMBOLS[c.u])) { setGrid(pg); setView(pg); setPend({ grid: pg, rerolled: !!save.pend.rr }); } }
            setMsg('저장된 진행을 불러왔습니다');
        }
        setLoaded(true);
    }, [saved.ready]); // eslint-disable-line
    useEffect(() => {
        if (!restored.current || !loaded || phase === 'battle') return;
        setSave({ coins, shards, units: units.map((u) => [ALLIES.indexOf(u.def), u.rarity, u.lv, u.enh, u.cell, u.promo || 0, ...(u.eng || [0, 0, 0, 0]), u.abs || 1, u.off ? 1 : 0, u.promo2 || 0]), region, stage: stageIdx, cleared, cores, ups, pend: pend ? { g: pend.grid.map((c) => [c.u, 0]), rr: pend.rerolled } : null });
    }, [coins, shards, units, region, stageIdx, cleared, phase, pend, cores, ups, loaded]); // eslint-disable-line
    const [xfer, setXfer] = useState('');
    const exportSave = () => setXfer(JSON.stringify({ coins, shards, units: units.map((u) => [ALLIES.indexOf(u.def), u.rarity, u.lv, u.enh, u.cell, u.promo || 0, ...(u.eng || [0, 0, 0, 0]), u.abs || 1, u.off ? 1 : 0, u.promo2 || 0]), region, stage: stageIdx, cleared, cores, ups }));
    const importSave = () => {
        try {
            const q = JSON.parse(xfer); if (!q || !Array.isArray(q.units)) throw new Error('x');
            setUnits(((l: Unit[]) => { let n = 0; return l.map((u) => (u.off ? u : ++n <= MAX_UNITS ? u : { ...u, off: true })); })(q.units.map((a: number[]) => ({ uid: uidSeq++, def: ALLIES[a[0]], rarity: a[1] as 0 | 1 | 2, lv: a[2], enh: a[3], cell: a[4], promo: a[5] || 0, eng: [a[6] || 0, a[7] || 0, a[8] || 0, a[9] || 0], abs: a[10] || absFromStar(a[1], a[2]), off: a[11] === 1, promo2: a[12] || 0 })).filter((u: Unit) => u.def)));
            setCoins(q.coins | 0); setShards(q.shards | 0); setRegion(Math.min(q.region | 0, REGIONS.length - 1)); setStageIdx(q.stage | 0); setCleared(q.cleared || {}); setUps(Array.isArray(q.ups) ? q.ups.filter((x: string) => UPS.some((d) => d.id === x)).slice(0, 40) : []); setUpOffer(null); setCores(Array.isArray(q.cores) ? q.cores.filter((x: string) => CORES.some((c) => c.id === x)).slice(0, MAX_CORES) : []); setOffer(null); setSpins(0); setNudges(NUDGE_PER_WAVE); battleRef.current = null; setPend(null); setGrid(null); setView(null); setPhase('prep'); setMsg('불러왔습니다'); setMap(false);
        } catch { setMsg('저장 코드를 읽지 못했습니다'); }
    };
    const [speed, setSpeed] = useState(1); const speedRef = useRef(1); speedRef.current = speed;
    const [confirmReset, setConfirmReset] = useState(false);
    useEffect(() => { if (!confirmReset) return; const t = setTimeout(() => setConfirmReset(false), 4000); return () => clearTimeout(t); }, [confirmReset]);
    const resetAll = () => { if (!confirmReset) { setConfirmReset(true); return; } setConfirmReset(false); setUnits([]); setCores([]); setUps([]); setUpOffer(null); setOffer(null); setSpins(0); setNudges(NUDGE_PER_WAVE); setCoins(12); setShards(0); setRegion(0); setStageIdx(0); setCleared({}); battleRef.current = null; setPend(null); setGrid(null); setView(null); setHeld([false, false, false]); setPhase('prep'); setMap(false); setMsg('처음부터 시작'); };

    const reg = REGIONS[region];
    const board = units.filter((u) => !u.off); const benchN = units.length - board.length;
    const [diff, setDiffS] = useState<number>(() => { try { return Math.min(2, Math.max(0, parseInt(localStorage.getItem('sk-diff') || '1', 10) || 0)); } catch { return 1; } });
    const setDiff = (d: number) => { setDiffS(d); try { localStorage.setItem('sk-diff', String(d)); } catch { /* */ } };
    const DIFFS = [{ n: '이지', m: 0.8, r: 0.8 }, { n: '노멀', m: 1, r: 1 }, { n: '하드', m: 1.3, r: 1.5 }]; // 우리 설계, 임시(미측정)
    const stage = (() => { const s0 = buildStage(reg, stageIdx); const d = DIFFS[diff]; return { ...s0, mult: s0.mult * d.m, reward: Math.round(s0.reward * d.r) }; })();

    useEffect(() => {
        if (!ready) return;
        let raf = 0; let last = performance.now(); let acc = 0;
        const loop = (now: number) => {
            const dt = Math.min(50, now - last); last = now;
            const c = canvasRef.current; const b = battleRef.current;
            if (b) {
                for (let k = 0; k < speedRef.current; k++) step(b, dt);
                if (b.events) { for (const e of b.events.splice(0)) fxRef.current?.add(e); } fxRef.current?.update(dt * speedRef.current);
                acc += dt; if (acc > 150) { acc = 0; setKills([b.kills, b.total]); }
                if (b.loot && b.loot > lootApplied.current) { const d = b.loot - lootApplied.current; lootApplied.current = b.loot; setCoins((c) => c + d); }
                if (b.result && phaseRef.current === 'battle') {
                    setKills([b.kills, b.total]);
                    if (!b.rewarded) {
                        b.rewarded = true;
                        const st = b.stage;
                        if (b.result === 'win') {
                            setCleared((c) => ({ ...c, [st.label]: true }));
                            const rw = Math.round(st.reward * (coresRef.current.includes('purse') ? 1.25 : 1)) + 2 * upsRef.current.filter((x) => x === 'loot').length; setCoins((c) => c + rw);
                            setUpOffer(rollUps(upsRef.current).map((x) => x.id));
                            if (coresRef.current.length < MAX_CORES) setOffer(rollCores(coresRef.current).map((x) => x.id));
                            setMsg(`승리 · 코인 +${rw}`);
                        } else {
                            setCoins((c) => c + 1);
                            setMsg('패배 · 코인 +1 · 더 소환하고 재도전');
                        }
                    }
                    setPhase(b.result);
                }
            }
            if (c) { const ctx = c.getContext('2d'); if (ctx) { drawBattle(ctx, b, [], bgsRef.current, REGIONS[regionRef.current].bg, null); fxRef.current?.draw(ctx); } }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [ready]);

    const heldCount = held.filter(Boolean).length;
    const [spins, setSpins] = useState(0); const [nudges, setNudges] = useState(NUDGE_PER_WAVE);
    useEffect(() => { setSpins(0); setNudges(NUDGE_PER_WAVE); }, [region, stageIdx]);
    const spinCost = SUMMON_COST + Math.min(3, Math.floor(spins / 3)); void heldCount;
    const nudge = (c: number) => {
        if (!pend || nudges < 1 || spinning) return;
        const ng = pend.grid.map((cell, i) => { if (i % 3 !== c) return cell; const r = Math.floor(i / 3); return pend.grid[((r + 2) % 3) * 3 + c]; });
        setNudges((n) => n - 1); setGrid(ng); setView(ng); setPend({ grid: ng, rerolled: pend.rerolled }); setMsg(`${c + 1}열을 한 칸 내렸습니다(웨이브당 ${NUDGE_PER_WAVE}회)`);
    };
    const summon = () => {
        if (pend) { const e = evalGrid(pend.grid); if (e.units || e.shards) { commit(pend.grid); return; } }
        if (spinning || coins < spinCost || units.length >= MAX_ROSTER) return;
        if (pend) setPend(null);
        setCoins((c) => c - spinCost); setSpins((n) => n + 1); setSpinning(true); setSel(null); setFlash(false);
        const base = grid; const keep = held.slice();
        const fin: GridCell[] = Array.from({ length: 9 }, (_, i) => (base && keep[i % 3] ? base[i] : rollCell()));
        setHeld([false, false, false]); setUndo(null);
        const cols = [0, 1, 2]; const stopAt = [650, 1000, 1350];
        const near = GRID_LINES.some((l) => l[0] % 3 === 0 && l[1] % 3 === 1 && fin[l[0]].u === fin[l[1]].u); // 앞 두 칸이 같으면 마지막 릴을 늦게 멈춤(기대감 연출, 우리 설계·임시)
        if (near) { stopAt[2] = 2100; setMsg('두 칸 일치… 마지막 릴이 천천히 멈춥니다'); }
        const t0 = performance.now();
        const iv = setInterval(() => {
            const el = performance.now() - t0;
            setView(Array.from({ length: 9 }, (_, i) => (el >= stopAt[i % 3] || (base && keep[i % 3]) ? fin[i] : rollCell())));
            if (el >= stopAt[2] + 40) {
                clearInterval(iv); setView(fin); setGrid(fin); setSpinning(false); setPend({ grid: fin, rerolled: false }); { const e = evalGrid(fin); if (!(e.units || e.shards)) setCoins((c) => c + 1); setMsg(e.units || e.shards ? '한 줄 같은 아이콘 = 소환 (◆줄 = 코인)' : '무당첨 · 환급 ●1 · 리롤 ●1 또는 다시 소환'); };
            }
        }, 80);
        void cols;
    };
    const commit = (g: GridCell[]) => {
        const ev = evalGrid(g);
        const made: Unit[] = [];
        for (const w of ev.wins) if (w.kind === 'line') { const sym = g[w.cells[0]].u; for (let k = 0; k < LINE_SUMMON; k++) { const p = rollSymbolUnit(sym); made.push({ uid: uidSeq++, def: p.def, rarity: p.r, cell: -1, lv: 1, enh: 0, abs: 1 }); } }
        const lineWins = ev.wins.filter((w) => w.kind === 'line'); const cx: string[] = [];
        const mk = (sym: number) => { const p = rollSymbolUnit(sym); made.push({ uid: uidSeq++, def: p.def, rarity: p.r, cell: -1, lv: 1, enh: 0, abs: 1 }); };
        if (cores.includes('duo') && lineWins.length >= 2) { mk(g[lineWins[0].cells[0]].u); cx.push('쌍줄 코어: +1기'); }
        if (cores.includes('quad')) { const seen = new Set<number>(); for (const w of lineWins) { const sym = g[w.cells[0]].u; if (seen.has(sym)) continue; seen.add(sym); if (g.filter((c) => c.u === sym).length >= 4) { mk(sym); cx.push('다중 심볼 코어: +1기'); } } }
        if (cores.includes('tri') && lineWins.length >= 3) { setCoins((c) => c + 3); cx.push('삼연 코어: 코인 +3'); }
        const bonus = Math.round(ev.shards * 0.6); if (bonus) setCoins((c) => c + bonus);
        const parts: string[] = [];
        let list = [...units]; let benched = 0; const slotUp: string[] = []; const entered: Unit[] = [];
        for (const mu of made) {
            if (list.filter((x) => !x.off).length < MAX_UNITS) { list.push(mu); entered.push(mu); continue; }
            const tgt = list.filter((x) => !x.off && x.def.id === mu.def.id).sort((p, q) => (q.abs || 1) - (p.abs || 1))[0];
            if (tgt) { const { t2, gain } = absorbCalc(tgt, mu); list = list.map((x) => (x.uid === tgt.uid ? t2 : x)); slotUp.push(`${tgt.def.name}|${gain}|${t2.lv}`); }
            else { list.push({ ...mu, off: true }); benched++; }
        }
        const br = battleRef.current; if (phase === 'battle' && br && !br.result) { const on = list.filter((x) => !x.off); entered.forEach((u) => addAllyToBattle(br, u, on, cores, ups)); if (lineWins.length) lineSurge(br, lineWins.length, g[lineWins[0].cells[0]].u); setSurgePct(Math.round(((br.surge || 1) - 1) * 100)); }
        if (made.length) parts.push(`${ev.wins.filter((w) => w.kind === 'line').length}줄 소환 ${made.length}기`); if (phase === 'battle' && lineWins.length) parts.push(`줄 기세 공격 +${lineWins.length * 6}%(당첨 심볼 계열 +${lineWins.length * 12}%)·체력 회복`); if (bonus) parts.push(`◆줄 코인 +${bonus}`); parts.push(...cx);
        setMsg(parts.join(' · ') + (slotUp.length ? ` · ${Object.entries(slotUp.reduce((m: Record<string, [number, number]>, s) => { const [n, gn, lv] = s.split('|'); const p = m[n] || [0, 0]; m[n] = [p[0] + Number(gn), Math.max(p[1], Number(lv))]; return m; }, {})).map(([n, v]) => `${n} 슬롯 강화 +${v[0]}${v[1] > 1 ? ` (★${v[1]})` : ''}`).join(', ')}` : '') + (benched ? ` · 출전 ${MAX_UNITS}기 가득: ${benched}기는 대기(유닛 선택 후 교체 가능)` : ''));
        setUnits(list);
        setPend(null); setFlash(true); setUndo(null); setTimeout(() => setFlash(false), 900);
    };
    const rerollCol = (c: number) => {
        if (!pend || pend.rerolled || coins < REROLL_COST) return;
        setCoins((x) => x - REROLL_COST);
        const ng = pend.grid.map((cell, i) => (i % 3 === c ? rollCell() : cell));
        setGrid(ng); setView(ng); setPend({ grid: ng, rerolled: true }); setMsg('리롤 완료 · 소환 확정을 누르세요');
    };
    const toggleHold = (c: number) => { if (spinning || pend || !grid) return; setHeld((h) => { const n = h.slice(); n[c] = !n[c]; if (n.filter(Boolean).length > 1) return [false, false, false].map((_, i) => i === c); return n; }); };

    const selUnit = units.find((u) => u.uid === sel) || null;
    const [absorbFor, setAbsorbFor] = useState<number | null>(null);
    const promote = (br: number) => {
        if (!selUnit || selUnit.lv < 2 || selUnit.promo) return;
        setUnits(units.map((u) => (u.uid === selUnit.uid ? { ...u, promo: br + 1 } : u))); setMsg(`${selUnit.def.name} 승급: ${PROMOS[selUnit.def.role][br]}`);
    };
    const [swapFor, setSwapFor] = useState<number | null>(null);
    const promote2 = (br: number) => {
        if (!selUnit || selUnit.lv < 3 || !selUnit.promo || selUnit.promo2) return;
        setUnits(units.map((u) => (u.uid === selUnit.uid ? { ...u, promo2: br + 1 } : u))); setMsg(`${selUnit.def.name} 2차 승급: ${PROMOS2[selUnit.def.role][br]}`);
    };
    const toggleOff = (uid: number) => {
        const t = units.find((u) => u.uid === uid); if (!t) return;
        if (!t.off) { if (board.length <= 1) { setMsg('출전 유닛이 최소 1기는 있어야 합니다'); return; } setUnits(units.map((u) => (u.uid === uid ? { ...u, off: true } : u))); setMsg(`${t.def.name} 출전 제외(대기). 삭제되지 않고 보유 중입니다`); }
        else if (board.length < MAX_UNITS) { setUnits(units.map((u) => (u.uid === uid ? { ...u, off: false } : u))); setMsg(`${t.def.name} 출전`); }
        else { setSwapFor(uid); setMsg('출전 중인 교체 대상 유닛을 아래 목록에서 누르세요'); }
    };
    const swapWith = (outUid: number) => {
        const t = units.find((u) => u.uid === swapFor); const o = units.find((u) => u.uid === outUid); setSwapFor(null);
        if (!t || !o || o.off) return;
        setUnits(units.map((u) => (u.uid === t.uid ? { ...u, off: false } : u.uid === o.uid ? { ...u, off: true } : u))); setSel(t.uid); setMsg(`${o.def.name} ↔ ${t.def.name} 교체 (${o.def.name}은 대기, 삭제 아님)`);
    };
    const absorb = (srcUid: number) => {
        const t = units.find((u) => u.uid === absorbFor); const src = units.find((u) => u.uid === srcUid);
        if (!t || !src || t.uid === src.uid) return;
        const { t2, gain, note, abs } = absorbCalc(t, src);
        setUnits(units.filter((u) => u.uid !== src.uid).map((u) => (u.uid === t.uid ? t2 : u)));
        setMsg(`${src.def.name} 흡수 → 흡수Lv +${gain} (${abs})${t2.lv > t.lv ? ` · ★${t2.lv} 상승!` : ''} · ${note}`); setAbsorbFor(null); setSel(t.uid);
    };

    useEffect(() => {
        if (!ready || phase !== 'prep') return;
        const c = startBattle(units.filter((u) => !u.off), stage, true, cores, ups); c.events = []; battleRef.current = c;
    }, [units, phase, region, stageIdx, ready]); // eslint-disable-line
    const [surgePct, setSurgePct] = useState(0); // 전투 중 줄 기세 누적(표시용)
    const startFight = () => {
        setSurgePct(0);
        if (!reg.ready || board.length === 0) { setMsg('먼저 소환해서 유닛을 모으세요'); return; }
        lootApplied.current = 0; battleRef.current = startBattle(board, stage, false, cores, ups); battleRef.current.events = []; fxRef.current?.clear(); setKills([0, stage.spawns.length]); setPhase('battle'); setMsg(''); setSel(null);
    };
    const toPrep = (nextStage?: number) => { battleRef.current = null; setPhase('prep'); if (nextStage !== undefined) setStageIdx(nextStage); setKills([0, 0]); setMsg('소환으로 유닛을 모으고 전투 시작'); };
    const next = () => {
        if (stageIdx < STAGES_PER_REGION - 1) toPrep(stageIdx + 1);
        else if (region < REGIONS.length - 1 && REGIONS[region + 1].ready) { setRegion(region + 1); toPrep(0); }
        else { toPrep(stageIdx); setMsg('다음 지역은 에셋 확보 전이라 잠겨 있습니다'); }
    };
    // 지역 해금(우리 설계, 임시): 이전 지역 보스를 클리어해야 다음 지역 입장. 이미 그 지역(또는 이후)에 있는 기존 저장은 막지 않음
    const regOpen = (ri: number) => ri === 0 || ri <= region || !!cleared[`${REGIONS[ri - 1].id}-${STAGES_PER_REGION}`];
    const goStage = (ri: number, si: number) => { if (phase === 'battle') return; if (!regOpen(ri)) { setMsg(`${REGIONS[ri].id}지역은 ${REGIONS[ri - 1].id}지역 보스를 쓰러뜨리면 열립니다(임시 규칙)`); return; } setRegion(ri); toPrep(si); setMap(false); };

    const syn = synergy(board);
    return <div className="sb-app">
        <div className="sb-top">
            <button type="button" className="sb-stage" onClick={() => setMap(true)} disabled={phase === 'battle'}><b>{reg.id} {reg.name}</b><span>{stage.label} {stage.kind}</span></button>
            <div className="sb-res"><span className="sb-coin" title="소환 코인">●</span><b>{coins}</b></div>
        </div>
        <div className="sb-cabinet">
        <div className="sb-field">
            <canvas ref={canvasRef} width={W} height={H} className="sb-canvas" aria-label="전장" />
            {phase === 'battle' && <div className="sb-prog"><i style={{ width: `${kills[1] ? (kills[0] / kills[1]) * 100 : 0}%` }} /><span>{kills[0]}/{kills[1]}</span></div>}
            {(phase === 'win' || phase === 'lose') && <div className={`sb-result ${phase}`}>{phase === 'win' ? '승리' : '패배'}<small>{msg}</small></div>}
            {!ready && <div className="sb-result">{loadError ? '일부 에셋을 불러오지 못했습니다. 새로고침 해주세요.' : `불러오는 중 ${loadProg}/${urls.length + 10}`}</div>}
        </div>
        <aside className="sb-side">
        {upOffer && <div className="sb-info" style={{ flexDirection: 'column' }}><b>승리 보상: 강화 선택 (개발중·임시, 우리 설계)</b>{upOffer.map((id) => { const d = UPS.find((x) => x.id === id)!; return <button key={id} type="button" className="sb-btn sm" onClick={() => { setUps((p) => [...p, id]); setUpOffer(null); setMsg(`${d.name} 획득 (${ups.filter((x) => x === id).length + 1}/${MAX_UP_STACK})`); }}>{d.name} ({ups.filter((x) => x === id).length}/{MAX_UP_STACK})<small>{d.desc}</small></button>; })}</div>}
        {ups.length > 0 && <div className="sb-info" style={{ flexDirection: 'column', gap: 2 }}><b>보유 강화</b><span>{UPS.filter((d) => ups.includes(d.id)).map((d) => `${d.name} x${ups.filter((x) => x === d.id).length}`).join(' · ')}</span></div>}
        {offer && <div className="sb-info" style={{ flexDirection: 'column' }}><b>코어 선택 (개발중·임시)</b>{offer.map((id) => { const c = CORES.find((x) => x.id === id)!; return <button key={id} type="button" className="sb-btn sm" onClick={() => { setCores((p) => [...p, id]); setOffer(null); setMsg(`${c.name} 획득`); }}>{c.name}<small>{c.orig ? '[원작 문구] ' : '[우리 설계] '}{c.desc}</small></button>; })}</div>}
        {cores.length > 0 && <div className="sb-info" style={{ flexDirection: 'column', gap: 2 }}><b>보유 코어 {cores.length}/{MAX_CORES}</b>{cores.map((id) => <span key={id}>{CORES.find((x) => x.id === id)?.name}: {CORES.find((x) => x.id === id)?.desc}</span>)}</div>}
        <div className="sb-syn"><span className="cnt">필드 유닛 {board.length}/{MAX_BOARD}{benchN ? ` · 대기 ${benchN}` : ''}</span><span>자동 이동 전투</span></div>
        {board.length >= MAX_UNITS && <div className="sb-fnote">출전 {MAX_UNITS}기 가득: 새로 나온 유닛은 대기로 가고, 출전 중인 같은 유닛이 있으면 그 유닛이 자동 강화됩니다(새 유닛만 흡수, 기존 유닛은 소모되지 않음).</div>}
        {phase === 'battle' && <div className="sb-fnote" style={{ color: surgePct > 0 ? '#ffd36b' : undefined }}>줄 기세 +{surgePct}% (이번 전투, 줄 당첨마다 누적 · 우리 설계·임시)</div>}
        <div className="sb-fnote">난이도 {DIFFS.map((d, i) => <button key={d.n} disabled={phase === 'battle'} onClick={() => setDiff(i)} style={{ margin: '0 3px', padding: '1px 7px', fontWeight: i === diff ? 700 : 400, opacity: i === diff ? 1 : 0.6 }}>{d.n}</button>)} 적 강도 ×{DIFFS[diff].m} · 승리 코인 ×{DIFFS[diff].r} (우리 설계·임시, 미측정)</div>
        {GIMMICKS[reg.id] && <div className="sb-fnote">지역 기믹 [{GIMMICKS[reg.id]!.name}] {GIMMICKS[reg.id]!.desc} (우리 설계·임시)</div>}
        {phase !== 'win' && phase !== 'lose' && <div className="sb-msg">{msg}</div>}
        <div className="sb-slot">
            <div className="sb-gridwrap">
                <div className={`sb-grid${flash ? ' flash' : ''}`}>{Array.from({ length: 9 }, (_, i) => {
                    const cur = (spinning ? view : (pend ? pend.grid : grid)); const cell = cur ? cur[i] : null;
                    const ev = !spinning && cur ? evalGrid(cur).wins : [];
                    const w = ev.find((x) => x.cells.includes(i));
                    return <div key={i} className={`sb-cell${w ? ' win' : ''}${w && w.kind === 'special' ? ' jp' : ''}${held[i % 3] ? ' held' : ''}`}>{cell ? <SymIcon sym={cell.u} /> : <span>?</span>}</div>;
                })}</div>
                <div className="sb-gridctl">{[0, 1, 2].map((c) => pend && !pend.rerolled
                    ? <button key={c} type="button" className="sb-mini" disabled={coins < REROLL_COST} onClick={() => rerollCol(c)}>↻{c + 1}열 ●{REROLL_COST}</button>
                    : <button key={c} type="button" className={`sb-mini${held[c] ? ' on' : ''}`} disabled={spinning || !!pend || !grid} onClick={() => toggleHold(c)}>{held[c] ? '고정됨' : '고정'}</button>)}</div>
                <div className="sb-gridctl">{[0, 1, 2].map((c) => <button key={c} type="button" className="sb-mini" disabled={!pend || nudges < 1 || spinning} onClick={() => nudge(c)}>넛지↓ {nudges}/{NUDGE_PER_WAVE}</button>)}</div>
            </div>
            <button type="button" className="sb-btn sb-summon" disabled={spinning || (units.length >= MAX_ROSTER && !(pend && (evalGrid(pend.grid).units || evalGrid(pend.grid).shards))) || ((!pend || !(evalGrid(pend.grid).units || evalGrid(pend.grid).shards)) && (coins < spinCost)) || !ready || !saved.ready} onClick={summon}>{pend && (evalGrid(pend.grid).units || evalGrid(pend.grid).shards) ? <>소환 확정<small>{evalGrid(pend.grid).units ? `${evalGrid(pend.grid).units}기` : `코인 +${Math.round(evalGrid(pend.grid).shards * 0.6)}`}</small></> : <>소환<small>{units.length >= MAX_ROSTER ? '보유 가득 · 흡수로 정리' : `● ${spinCost}`}</small></>}</button>
        </div>
        <div className="sb-bar">
            {phase === 'prep' && <><button type="button" className="sb-btn go" disabled={!ready || !reg.ready || spinning || (!!pend && !!(evalGrid(pend.grid).units || evalGrid(pend.grid).shards))} onClick={() => { if (pend) { setPend(null); setHeld([false, false, false]); } startFight(); }}>{pend && (evalGrid(pend.grid).units || evalGrid(pend.grid).shards) ? '소환 확정 먼저' : '전투 시작'}</button></>}
            {phase === 'battle' && <><button type="button" className="sb-btn go" disabled>전투 중</button><button type="button" className={`sb-btn ghost${speed > 1 ? ' on' : ''}`} onClick={() => setSpeed((v) => (v === 1 ? 2 : 1))} aria-pressed={speed > 1}>배속 ×{speed}</button></>}
            {phase === 'win' && <><button type="button" className="sb-btn go" onClick={next}>다음 전투</button><button type="button" className="sb-btn ghost" onClick={() => toPrep()}>정비</button></>}
            {phase === 'lose' && <button type="button" className="sb-btn go" onClick={() => toPrep()}>다시 준비</button>}
        </div>
        {selUnit && <div className="sb-info">
            <div><b>{selUnit.promo2 ? PROMOS2[selUnit.def.role][selUnit.promo2 - 1] : selUnit.promo ? PROMOS[selUnit.def.role][selUnit.promo - 1] : selUnit.def.name}</b> <span style={{ color: RARITY_COLOR[selUnit.rarity] }}>{RARITY_NAME[selUnit.rarity]}</span> · {selUnit.def.role} · ★{selUnit.lv}<br />흡수Lv {selUnit.abs || 1}{selUnit.lv < 3 ? `/${STAR_AT[selUnit.rarity][selUnit.lv - 1]}` : ' MAX'} · 각인칸 {(selUnit.eng || []).filter((x) => x > 0).length}/{IMP_SLOTS[selUnit.rarity]}<br />체력 {unitHp(selUnit)} 공격 {unitAtk(selUnit)}{selUnit.def.heal ? ` 치유 ${unitHeal(selUnit)}` : ''}
                <br />각인 {ENGRAVINGS.map((e, i) => (selUnit.eng && selUnit.eng[i] ? `${e.name}${selUnit.eng[i]}` : '')).filter(Boolean).join(' · ') || '없음'}</div>
            <div className="sb-acts">
                {selUnit.lv >= 3 && !!selUnit.promo && !selUnit.promo2 && [0, 1].map((br) => <button key={'p2' + br} type="button" className="sb-btn sm" onClick={() => promote2(br)}>2차 승급 {PROMOS2[selUnit.def.role][br]}<small>{PROMO2_DESC[br]} (임시)</small></button>)}
                {selUnit.lv >= 2 && !selUnit.promo && [0, 1].map((br) => <button key={br} type="button" className="sb-btn sm" onClick={() => promote(br)}>승급 {PROMOS[selUnit.def.role][br]}<small>{PROMO_DESC[br]}</small></button>)}
                <button type="button" className="sb-btn sm" disabled={phase === 'battle'} onClick={() => toggleOff(selUnit.uid)}>{!selUnit.off ? '출전 제외(대기)' : board.length < MAX_UNITS ? '출전시키기' : '출전 교체'}<small>삭제 아님</small></button>
                <button type="button" className={`sb-btn sm${absorbFor === selUnit.uid ? '' : ' ghost'}`} disabled={units.length < 2 || phase === 'battle'} onClick={() => { setAbsorbFor(absorbFor === selUnit.uid ? null : selUnit.uid); setMsg(absorbFor === selUnit.uid ? '' : '흡수할 유닛을 아래 목록에서 누르세요(흡수된 유닛은 사라지고 각인을 줍니다)'); }}>{absorbFor === selUnit.uid ? '흡수 취소' : '다른 유닛 흡수(각인)'}</button>
            </div>
            <div className="sb-fnote">별·승급·각인의 이름과 수치는 우리 설계(임시)입니다. 흡수 레벨로 별이 오르는 구조는 비공식 위키 서술을 따랐습니다. 원작은 분기 승급과 흡수 각인이 있다는 것까지만 확인했습니다.</div>
        </div>}
        <div className={`sb-save${saved.ready ? '' : ' warn'}`} role="status">{saved.ready ? (/not saved/i.test(saved.message || '') ? '저장 불가: 창을 닫으면 진행이 사라집니다. 지역 메뉴의 저장 코드를 보관하세요.' : '이 기기에 자동 저장됩니다.') : '저장 상태 확인 중'}</div>
        </aside>
        </div>
        <div className="sb-bench">
            {units.length === 0 && <span className="sb-empty">보유 유닛 없음 · 소환하세요</span>}
            {[...units.filter((u) => !u.off), ...units.filter((u) => u.off)].map((u) => <button type="button" key={u.uid} className={`sb-unit${sel === u.uid ? ' is-sel' : ''}${u.off ? ' is-off' : ''}`} style={{ borderColor: RARITY_COLOR[u.rarity] }} onClick={() => { if (swapFor !== null && !u.off && swapFor !== u.uid) swapWith(u.uid); else if (absorbFor !== null && absorbFor !== u.uid) absorb(u.uid); else setSel(sel === u.uid ? null : u.uid); }}>
                <Icon sheet={u.def.sheet} ready={ready} lv={u.lv} /><span className="sb-lv">{'★'.repeat(u.lv)}{u.promo2 ? '◈◈' : u.promo ? '◈' : ''}{u.eng && u.eng.some(Boolean) ? '✦' : ''}</span><small>{u.off ? '대기' : u.def.role}</small>
            </button>)}
        </div>
        {map && <div className="sb-map" role="dialog" aria-label="지역">
            <div className="sb-maphead"><b>지역</b><button type="button" className="sb-btn sm ghost" onClick={() => setMap(false)}>닫기</button></div>
            {REGIONS.map((r, ri) => {
                const done = Array.from({ length: STAGES_PER_REGION }, (_, k) => cleared[`${r.id}-${k + 1}`]).filter(Boolean).length;
                return <div key={r.id} className={`sb-reg${ri === region ? ' cur' : ''}${r.ready ? '' : ' lock'}`}>
                    <div className="sb-reghead"><b>{r.id} {r.name}</b>{r.temp && <small className="sb-temp">개발중 · 임시 보스</small>}{r.ready && <span className="sb-regprog">{done}/{STAGES_PER_REGION}</span>}</div>
                    {r.ready && !regOpen(ri) ? <small>잠김 · {REGIONS[ri - 1].id}지역 보스 클리어 필요 (우리 설계·임시)</small> : r.ready ? <div className="sb-dots">{Array.from({ length: STAGES_PER_REGION }, (_, k) => {
                        const isCur = ri === region && k === stageIdx;
                        const isDone = !!cleared[`${r.id}-${k + 1}`];
                        const elite = k === STAGES_PER_REGION - 2, boss = k === STAGES_PER_REGION - 1;
                        return <button type="button" key={k} className={`${isDone ? 'done' : ''}${isCur ? ' cur' : ''}${elite ? ' elite' : ''}${boss ? ' boss' : ''}`} onClick={() => goStage(ri, k)}>{isDone ? '✓' : boss ? '보스' : elite ? '정예' : k + 1}</button>;
                    })}</div> : <small>잠김 · {r.need}</small>}
                </div>;
            })}
            <div className="sb-xfer"><b>저장 코드</b><small>자동 저장이 안 되는 환경에서는 코드를 복사해 보관하세요.</small>
                <textarea value={xfer} onChange={(e) => setXfer(e.target.value)} rows={3} aria-label="저장 코드" />
                <div><button type="button" className="sb-btn sm ghost" onClick={exportSave}>내보내기</button> <button type="button" className="sb-btn sm ghost" onClick={importSave} disabled={phase === 'battle' || !xfer}>불러오기</button></div></div>
            <button type="button" className="sb-btn sm ghost" onClick={resetAll}>{confirmReset ? '한 번 더 누르면 초기화' : '진행 초기화'}</button>
            <p className="sb-credit">스프라이트: LuizMelo 팩(Hero Knight 1-2, Fantasy Warrior, Medieval Warrior 1-3, Medieval King 1-2, Martial Hero 1-3, Huntress 1-2, Evil Wizard 1-3, Fire Worm, Monsters Creatures Fantasy 1-2), Wizard Pack. 보스(3-8지역): chierit (CC-BY 4.0) — Boss: Demon Slime, Boss: Frost Guardian, Free Cthulhu, Elementals: Crystal Mauler / Fire Knight / Wind Hashashin (chierit.itch.io). 배경: 8개 지역 모두 AI 생성(쿼터뷰 전장 배경).</p>
        </div>}
    </div>;
}
