import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalState } from '@instinct/files';
import { FxLayer } from './fxlayer';
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
    ALLIES, REGIONS, RARITY_NAME, RARITY_COLOR, STAGES_PER_REGION, W, H, MAX_LV, MAX_ENH, buildStage, cellPos, drawBattle, drawSprite, iconDraw, allUrls, registerImg,
    rollRarity, rollUnit, startBattle, step, synergy, synergyBonus, unitMult, enhCost, shardValue, type Battle, type Unit,
  assignCells, optimizeFormation, unitPower, CELL_X,
} from './game';

const SUMMON_COST = 3;
const MAX_BOARD = 6;
let uidSeq = 1;
const ROLES = ['전열', '딜러', '원거리', '지원'] as const;

function Icon({ sheet, ready, lv = 1 }: { sheet: string; ready: boolean; lv?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => { if (ref.current && ready) iconDraw(ref.current, sheet, 38); }, [sheet, ready, lv]);
    return <canvas ref={ref} width={52} height={46} className="sb-icon" />;
}

const REEL_SLOT = 64;
function drawReelFrame(ctx: CanvasRenderingContext2D, pos: number, smear: number, w: number, h: number) {
    const L = ALLIES.length * REEL_SLOT;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < ALLIES.length; i++) {
        const y = (((i * REEL_SLOT + pos) % L) + L) % L - REEL_SLOT;
        if (y > h || y < -REEL_SLOT) continue;
        const cx = w / 2;
        if (smear > 0) { ctx.globalAlpha = 0.3; drawSprite(ctx, ALLIES[i].sheet, 'idle', 0, cx, y - smear + REEL_SLOT - 6, 44, false, true); ctx.globalAlpha = 1; }
        drawSprite(ctx, ALLIES[i].sheet, 'idle', 0, cx, y + REEL_SLOT - 6, 44, false, true);
    }
}

function Reel({ idx, spin, prev, ready, onStop }: { idx: number; spin: { targets: number[] } | null; prev: number | null; ready: boolean; onStop: (i: number) => void }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const cvs = ref.current; if (!cvs || !ready) return;
        const ctx = cvs.getContext('2d'); if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        const L = ALLIES.length * REEL_SLOT;
        if (!spin) { drawReelFrame(ctx, prev === null ? 0 : (L - prev * REEL_SLOT) % L, 0, cvs.width, cvs.height); return; }
        const target = spin.targets[idx];
        const stopStart = 1000 + idx * 550, DECEL = 800;
        let pos = prev === null ? 0 : (L - prev * REEL_SLOT) % L;
        let raf = 0, last = performance.now(), done = false;
        let posS: number | null = null, distS = 0;
        const t0 = last;
        const finalMod = (L - target * REEL_SLOT) % L;
        const tick = (now: number) => {
            const dt = Math.min(50, now - last); last = now;
            const el = now - t0;
            let smear = 0;
            if (el < stopStart) { pos = (pos + 1500 * dt / 1000) % L; smear = 10; }
            else {
                if (posS === null) { posS = pos; distS = ((finalMod - (pos % L) + L) % L) + L; }
                const u = Math.min(1, (el - stopStart) / DECEL);
                pos = posS + distS * (1 - Math.pow(1 - u, 3));
                smear = u < 0.7 ? 6 : 0;
                if (u >= 1 && !done) {
                    done = true;
                    pos = finalMod;
                    drawReelFrame(ctx, pos, 0, cvs.width, cvs.height);
                    onStop(idx);
                    return;
                }
            }
            drawReelFrame(ctx, pos, smear, cvs.width, cvs.height);
            if (!done) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [spin, ready]); // eslint-disable-line
    return <canvas ref={ref} width={52} height={REEL_SLOT} className="sb-reelcvs" />;
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
    const [sel, setSel] = useState<number | null>(null);
    const hoverRef = useRef<number | null>(null);
    const flashCellRef = useRef<{ cell: number; until: number } | null>(null);
    const [phase, setPhase] = useState<'prep' | 'battle' | 'win' | 'lose'>('prep');
    const [reels, setReels] = useState<(number | null)[]>([null, null, null]);
    const [reelRar, setReelRar] = useState<(number | null)[]>([null, null, null]);
    const [spinning, setSpinning] = useState(false);
    const [spin, setSpin] = useState<{ targets: number[]; rarities: number[] } | null>(null);
    const [stopped, setStopped] = useState(0);
    const [flash, setFlash] = useState(false);
    const [msg, setMsg] = useState('소환해서 유닛을 배치하세요');
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

    const [save, setSave, saved] = useLocalState<{ coins: number; shards: number; units: number[][]; region: number; stage: number; cleared: Record<string, boolean> } | null>('slotbound.save.v1', null);
    const restored = useRef(false);
    useEffect(() => {
        if (!saved.ready || restored.current) return; restored.current = true;
        if (save) {
            const us: Unit[] = save.units.map((q) => ({ uid: uidSeq++, def: ALLIES[q[0]], rarity: q[1] as 0 | 1 | 2, lv: q[2], enh: q[3], cell: q[4] })).filter((u) => u.def);
            setUnits(us); setCoins(save.coins); setShards(save.shards); setRegion(Math.min(save.region, REGIONS.length - 1)); setStageIdx(save.stage); setCleared(save.cleared || {});
            setMsg('저장된 진행을 불러왔습니다');
        }
    }, [saved.ready]); // eslint-disable-line
    useEffect(() => {
        if (!restored.current || phase === 'battle') return;
        setSave({ coins, shards, units: units.map((u) => [ALLIES.indexOf(u.def), u.rarity, u.lv, u.enh, u.cell]), region, stage: stageIdx, cleared });
    }, [coins, shards, units, region, stageIdx, cleared, phase]); // eslint-disable-line
    const [xfer, setXfer] = useState('');
    const exportSave = () => setXfer(JSON.stringify({ coins, shards, units: units.map((u) => [ALLIES.indexOf(u.def), u.rarity, u.lv, u.enh, u.cell]), region, stage: stageIdx, cleared }));
    const importSave = () => {
        try {
            const q = JSON.parse(xfer); if (!q || !Array.isArray(q.units)) throw new Error('x');
            setUnits(q.units.map((a: number[]) => ({ uid: uidSeq++, def: ALLIES[a[0]], rarity: a[1] as 0 | 1 | 2, lv: a[2], enh: a[3], cell: a[4] })).filter((u: Unit) => u.def));
            setCoins(q.coins | 0); setShards(q.shards | 0); setRegion(Math.min(q.region | 0, REGIONS.length - 1)); setStageIdx(q.stage | 0); setCleared(q.cleared || {}); battleRef.current = null; setPhase('prep'); setMsg('불러왔습니다'); setMap(false);
        } catch { setMsg('저장 코드를 읽지 못했습니다'); }
    };
    const resetAll = () => { setUnits([]); setCoins(12); setShards(0); setRegion(0); setStageIdx(0); setCleared({}); battleRef.current = null; setPhase('prep'); setMap(false); setMsg('처음부터 시작'); };

    const reg = REGIONS[region];
    const board = units.filter((u) => u.cell >= 0);
    const bench = units.filter((u) => u.cell < 0);
    const stage = buildStage(reg, stageIdx);

    useEffect(() => {
        if (!ready) return;
        let raf = 0; let last = performance.now(); let acc = 0;
        const loop = (now: number) => {
            const dt = Math.min(50, now - last); last = now;
            const c = canvasRef.current; const b = battleRef.current;
            if (b) {
                step(b, dt);
                if (b.events) { for (const e of b.events.splice(0)) fxRef.current?.add(e); } fxRef.current?.update(dt);
                acc += dt; if (acc > 150) { acc = 0; setKills([b.kills, b.total]); }
                if (b.result && phaseRef.current === 'battle') {
                    setKills([b.kills, b.total]);
                    if (!b.rewarded) {
                        b.rewarded = true;
                        const st = b.stage;
                        if (b.result === 'win') {
                            setCleared((c) => ({ ...c, [st.label]: true }));
                            setCoins((c) => c + st.reward);
                            setMsg(`승리 · 코인 +${st.reward}`);
                        } else {
                            setCoins((c) => c + 1);
                            setMsg('패배 · 코인 +1 · 배치를 바꿔 재도전');
                        }
                    }
                    setPhase(b.result);
                }
            }
            if (c) { const ctx = c.getContext('2d'); if (ctx) drawBattle(ctx, b, unitsRef.current.filter((u) => u.cell >= 0), bgsRef.current, REGIONS[regionRef.current].bg, phaseRef.current === 'prep' ? (flashCellRef.current && performance.now() < flashCellRef.current.until ? flashCellRef.current.cell : hoverRef.current) : null); fxRef.current?.draw(ctx); }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [ready]);

    const summon = useCallback(() => {
        if (spinning || phase === 'battle' || coins < SUMMON_COST) return;
        setCoins((c) => c - SUMMON_COST); setSpinning(true); setSel(null);
        setReelRar([null, null, null]); setFlash(false); setStopped(0);
        const picks = [0, 1, 2].map(() => ({ def: rollUnit(), r: rollRarity() }));
        setSpin({ targets: picks.map((p) => ALLIES.indexOf(p.def)), rarities: picks.map((p) => p.r) });
    }, [spinning, phase, coins]);

    useEffect(() => {
        if (!spin || stopped < 3) return;
        const made: Unit[] = spin.targets.map((t, i) => ({ uid: uidSeq++, def: ALLIES[t], rarity: spin.rarities[i] as 0 | 1 | 2, cell: -1, lv: 1, enh: 0 }));
        setUnits((u) => { const r = mergeAll([...u, ...made]); setMsg(r.merged.length ? `합성! ${r.merged.join(', ')}` : `소환: ${made.map((m) => m.def.name).join(', ')}`); return r.list; });
        setReels(spin.targets); setReelRar(spin.rarities);
        setSpin(null); setSpinning(false); setFlash(true); setUndo(null);
        const to = setTimeout(() => setFlash(false), 900);
        return () => clearTimeout(to);
    }, [spin, stopped]); // eslint-disable-line

    const onReelStop = useCallback(() => setStopped((c) => c + 1), []);

    const cellAt = (x: number, y: number): number => {
        // 가장 가까운 칸으로 스냅(사각지대·중첩 없음): 열 경계 68/120, 행 경계 167/201
        if (x < 10 || x > 178 || y < 120 || y > 245) return -1;
        const col = Math.max(0, Math.min(2, Math.round((x - 42) / 52)));
        const row = Math.max(0, Math.min(2, Math.round((y - 150) / 34)));
        return row * 3 + col;
    };

    const onCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (phase === 'battle') { hoverRef.current = null; return; }
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W; const y = ((e.clientY - r.top) / r.height) * H;
        const c = cellAt(x, y); hoverRef.current = c < 0 ? null : c;
    };

    const fillEmpty = () => {
        if (phase === 'battle') return;
        const placed = units.filter((u) => u.cell >= 0);
        const assign = assignCells(units.filter((u) => u.cell < 0), new Set(placed.map((u) => u.cell)), MAX_BOARD);
        if (!assign.size) { setMsg('빈 칸에 놓을 대기 유닛이 없습니다(기존 배치는 그대로)'); return; }
        setUndo(units.map((u) => ({ ...u })));
        setUnits(units.map((u) => (assign.has(u.uid) ? { ...u, cell: assign.get(u.uid)! } : u)));
        setMsg(`빈 칸에 ${assign.size}기 배치(기존 배치 유지) · 되돌리기 가능`);
    };
    const autoFormation = () => {
        if (phase === 'battle' || !units.length) return;
        const plan = optimizeFormation(units, stage);
        const changed = units.filter((u) => u.cell >= 0 && plan.cells.get(u.uid) !== u.cell).length;
        setUndo(units.map((u) => ({ ...u })));
        setUnits(units.map((u) => ({ ...u, cell: plan.cells.has(u.uid) ? plan.cells.get(u.uid)! : -1 })));
        setMsg(`추천 편성 ${plan.picked}기 · ${stage.label} 제한 모의(8회) 참고 승률 ${Math.round(plan.winRate * 100)}%, 최적 보장 아님${changed ? ` · 기존 배치 ${changed}기 변경(되돌리기 가능)` : ''}`);
    };
    const undoFormation = () => {
        if (!undo) return;
        const ids = new Set(undo.map((u) => u.uid));
        if (undo.length !== units.length || units.some((u) => !ids.has(u.uid))) { setUndo(null); setMsg('유닛이 바뀌어 되돌릴 수 없습니다'); return; }
        const cellOf = new Map(undo.map((u) => [u.uid, u.cell]));
        setUnits(units.map((u) => ({ ...u, cell: cellOf.get(u.uid)! })));
        setUndo(null); setMsg('이전 배치로 되돌렸습니다');
    };
    const placeTo = (uid: number, cell: number) => {
        const u = units.find((x) => x.uid === uid); if (!u) return;
        const t = units.find((x) => x.cell === cell && x.uid !== uid);
        if (!t && u.cell < 0 && board.length >= MAX_BOARD) { setMsg(`출전은 최대 ${MAX_BOARD}명. 배치된 유닛을 내려주세요`); return; }
        setUnits(units.map((x) => (x.uid === uid ? { ...x, cell } : t && x.uid === t.uid ? { ...x, cell: u.cell } : x)));
        flashCellRef.current = { cell, until: performance.now() + 800 };
        setMsg(t ? `${u.def.name} ↔ ${t.def.name} 자리 교체` : `${u.def.name} 배치`);
        setSel(null);
    };
    const unplace = (uid: number) => { setUnits(units.map((x) => (x.uid === uid ? { ...x, cell: -1 } : x))); setSel(null); setMsg('출전 해제'); };
    const formCell = (cell: number) => {
        const here = units.find((u) => u.cell === cell);
        if (sel !== null) { if (here && here.uid === sel) { setSel(null); return; } placeTo(sel, cell); }
        else if (here) setSel(here.uid);
    };

    const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (phase === 'battle') return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W; const y = ((e.clientY - r.top) / r.height) * H;
        const cell = cellAt(x, y);
        if (cell < 0) return;
        const here = units.find((u) => u.cell === cell);
        if (sel !== null) {
            if (here) setUnits(units.map((u) => (u.uid === here.uid ? { ...u, cell: -1 } : u.uid === sel ? { ...u, cell } : u)));
            else if (board.length >= MAX_BOARD) { setMsg(`출전은 최대 ${MAX_BOARD}명. 배치된 유닛을 눌러 내리세요`); return; }
            else setUnits(units.map((u) => (u.uid === sel ? { ...u, cell } : u)));
            { const pp = cellPos(cell); fxRef.current?.add({ k: 'death', x: pp.x, y: pp.y - 6, flip: false }); }
            flashCellRef.current = { cell, until: performance.now() + 800 };
            setSel(null);
        } else if (here) setUnits(units.map((u) => (u.uid === here.uid ? { ...u, cell: -1 } : u)));
    };

    const selUnit = units.find((u) => u.uid === sel) || null;
    const decompose = () => { if (!selUnit) return; const v = shardValue(selUnit); setShards((s) => s + v); setUnits(units.filter((u) => u.uid !== selUnit.uid)); setSel(null); setMsg(`${selUnit.def.name} 분해 · 조각 +${v}`); };
    const enhance = () => {
        if (!selUnit || selUnit.enh >= MAX_ENH) return; const c = enhCost(selUnit); if (shards < c) { setMsg(`강화 조각 ${c}개 필요`); return; }
        setShards(shards - c); setUnits(units.map((u) => (u.uid === selUnit.uid ? { ...u, enh: u.enh + 1 } : u))); setMsg(`${selUnit.def.name} 강화 +${selUnit.enh + 1}`);
    };

    const startFight = () => {
        if (!reg.ready || board.length === 0) { setMsg('먼저 유닛을 칸에 놓으세요'); return; }
        battleRef.current = startBattle(board, stage); battleRef.current.events = []; fxRef.current?.clear(); setKills([0, stage.spawns.length]); setPhase('battle'); setMsg(''); setSel(null);
    };
    const toPrep = (nextStage?: number) => { battleRef.current = null; setPhase('prep'); if (nextStage !== undefined) setStageIdx(nextStage); setKills([0, 0]); setMsg('배치를 정하고 전투 시작'); };
    const next = () => {
        if (stageIdx < STAGES_PER_REGION - 1) toPrep(stageIdx + 1);
        else if (region < REGIONS.length - 1 && REGIONS[region + 1].ready) { setRegion(region + 1); toPrep(0); }
        else { toPrep(stageIdx); setMsg('다음 지역은 에셋 확보 전이라 잠겨 있습니다'); }
    };
    const goStage = (ri: number, si: number) => { if (phase === 'battle') return; setRegion(ri); toPrep(si); setMap(false); };

    const syn = synergy(board);
    return <div className="sb-app">
        <div className="sb-top">
            <button type="button" className="sb-stage" onClick={() => setMap(true)} disabled={phase === 'battle'}><b>{reg.id} {reg.name}</b><span>{stage.label} {stage.kind}</span></button>
            <div className="sb-res"><span className="sb-coin" title="소환 코인">●</span><b>{coins}</b><span className="sb-shard" title="강화 조각">◆</span><b>{shards}</b></div>
        </div>
        <div className="sb-cabinet">
        <div className="sb-field">
            <canvas ref={canvasRef} width={W} height={H} className="sb-canvas" onPointerDown={onCanvas} onPointerMove={onCanvasMove} onPointerLeave={() => { hoverRef.current = null; }} aria-label="전장" />
            {phase === 'battle' && <div className="sb-prog"><i style={{ width: `${kills[1] ? (kills[0] / kills[1]) * 100 : 0}%` }} /><span>{kills[0]}/{kills[1]}</span></div>}
            {(phase === 'win' || phase === 'lose') && <div className={`sb-result ${phase}`}>{phase === 'win' ? '승리' : '패배'}<small>{msg}</small></div>}
            {!ready && <div className="sb-result">{loadError ? '일부 에셋을 불러오지 못했습니다. 새로고침 해주세요.' : `불러오는 중 ${loadProg}/${urls.length + 10}`}</div>}
        </div>
        <aside className="sb-side">
        <div className="sb-syn">
            {ROLES.map((r) => <span key={r} className={syn[r] ? 'on' : ''}>{r} {syn[r] || 0}{synergyBonus(syn[r] || 0) ? <em>+{Math.round(synergyBonus(syn[r]) * 100)}%</em> : null}</span>)}
            <span className="cnt">출전 {board.length}/{MAX_BOARD}</span>
        </div>
        {phase !== 'win' && phase !== 'lose' && <div className="sb-msg">{msg}</div>}
        <div className="sb-slot">
            <div className={`sb-reels${flash ? ' flash' : ''}`}>{[0, 1, 2].map((i) => <div key={i} className={`sb-reel${spin && i < stopped ? ' hit' : ''}`} style={!spinning && reelRar[i] !== null ? { borderColor: RARITY_COLOR[reelRar[i] as 0 | 1 | 2] } : undefined}>{spinning || spin ? <Reel idx={i} spin={spin} prev={reels[i]} ready={ready} onStop={onReelStop} /> : reels[i] === null ? <span>?</span> : <Icon sheet={ALLIES[reels[i] as number].sheet} ready={ready} />}</div>)}</div>
            <button type="button" className="sb-btn sb-summon" disabled={spinning || phase === 'battle' || coins < SUMMON_COST || !ready || !saved.ready} onClick={summon}>소환<small>● {SUMMON_COST}</small></button>
        </div>
        <div className="sb-bar">
            {phase === 'prep' && <><button type="button" className="sb-btn go" disabled={!ready || !reg.ready} onClick={startFight}>전투 시작</button><button type="button" className="sb-btn ghost" disabled={!ready} onClick={() => setFormOpen(true)}>편성</button><button type="button" className="sb-btn ghost" disabled={!ready || !units.length} onClick={autoFormation}>자동 편성</button>{undo && <button type="button" className="sb-btn ghost" onClick={undoFormation}>되돌리기</button>}</>}
            {phase === 'battle' && <button type="button" className="sb-btn go" disabled>전투 중</button>}
            {phase === 'win' && <><button type="button" className="sb-btn go" onClick={next}>다음 전투</button><button type="button" className="sb-btn ghost" onClick={() => toPrep()}>정비</button></>}
            {phase === 'lose' && <button type="button" className="sb-btn go" onClick={() => toPrep()}>다시 준비</button>}
        </div>
        {selUnit && <div className="sb-info">
            <div><b>{selUnit.def.name}</b> <span style={{ color: RARITY_COLOR[selUnit.rarity] }}>{RARITY_NAME[selUnit.rarity]}</span> · {selUnit.def.role} · Lv{selUnit.lv}<br />체력 {Math.round(selUnit.def.hp * unitMult(selUnit))} 공격 {Math.round(selUnit.def.atk * unitMult(selUnit))}{selUnit.def.heal ? ` 치유 ${Math.round(selUnit.def.heal * unitMult(selUnit))}` : ''} · 칸을 눌러 배치</div>
            <div className="sb-acts"><button type="button" className="sb-btn sm" onClick={enhance} disabled={selUnit.enh >= MAX_ENH}>강화 ◆{selUnit.enh >= MAX_ENH ? '최대' : enhCost(selUnit)}</button><button type="button" className="sb-btn sm ghost" onClick={decompose}>분해 +◆{shardValue(selUnit)}</button></div>
        </div>}
        <div className={`sb-save${saved.ready ? '' : ' warn'}`} role="status">{saved.ready ? (/not saved/i.test(saved.message || '') ? '저장 불가: 창을 닫으면 진행이 사라집니다. 지역 메뉴의 저장 코드를 보관하세요.' : '이 기기에 자동 저장됩니다.') : '저장 상태 확인 중'}</div>
        </aside>
        </div>
        <div className="sb-bench">
            {bench.length === 0 && <span className="sb-empty">벤치 비어 있음</span>}
            {bench.map((u) => <button type="button" key={u.uid} className={`sb-unit${sel === u.uid ? ' is-sel' : ''}`} style={{ borderColor: RARITY_COLOR[u.rarity] }} onClick={() => setSel(sel === u.uid ? null : u.uid)}>
                <Icon sheet={u.def.sheet} ready={ready} lv={u.lv} /><span className="sb-lv">{'★'.repeat(u.lv)}{u.enh ? ` +${u.enh}` : ''}</span><small>{u.def.role}</small>
            </button>)}
        </div>
        {formOpen && <div className="sb-form" role="dialog" aria-label="편성">
            <div className="sb-maphead"><b>편성 <small>출전 {board.length}/{MAX_BOARD}</small></b><button type="button" className="sb-btn sm ghost" onClick={() => { setFormOpen(false); setSel(null); }}>닫기</button></div>
            <div className="sb-syn">{ROLES.map((r) => <span key={r} className={syn[r] ? 'on' : ''}>{r} {syn[r] || 0}{synergyBonus(syn[r] || 0) ? <em>+{Math.round(synergyBonus(syn[r]) * 100)}%</em> : null}</span>)}</div>
            <div className="sb-fdir"><span>◀ 후방</span><span>적 진입 방향 · 전방 ▶</span></div>
            <div className="sb-fnote">사거리 전열 54 · 딜러 120 · 원거리/지원 200. 앞열이 적을 막을 때 사거리 짧은 유닛을 뒷열에 두면 닿기 어려울 수 있습니다(⚠, 적 종류에 따라 다름).</div>
            <div className="sb-fgrid">{Array.from({ length: 9 }, (_, c) => {
                const u = units.find((x) => x.cell === c);
                const frontHeld = units.some((x) => x.cell >= 0 && x.cell % 3 === 2);
                const blocked = !!u && c % 3 < 2 && frontHeld && u.def.range + 6 < (CELL_X[2] - CELL_X[c % 3]) + 34;
                return <button type="button" key={c} className={`sb-fcell${u ? ' has' : ''}${blocked ? ' warn' : ''}${u && sel === u.uid ? ' is-sel' : ''}${sel !== null && !(u && sel === u.uid) ? ' target' : ''}`} onClick={() => formCell(c)} aria-label={`${c % 3 === 2 ? '전방' : c % 3 === 0 ? '후방' : '중앙'} ${Math.floor(c / 3) + 1}행`}>
                    {u ? <><Icon sheet={u.def.sheet} ready={ready} lv={u.lv} /><span>{u.def.role} {'★'.repeat(u.lv)}</span>{blocked && <em className="sb-warn">⚠ 닿기 어려움</em>}</> : <small>{sel !== null ? '여기에 배치' : '빈 칸'}</small>}
                </button>;
            })}</div>
            <div className="sb-factions">
                <button type="button" className="sb-btn sm" disabled={!units.length} onClick={autoFormation}>추천 편성(전체 재선발)</button>
                <button type="button" className="sb-btn sm ghost" disabled={!bench.length} onClick={fillEmpty}>빈 칸 채우기</button>
                <button type="button" className="sb-btn sm ghost" disabled={!board.length} onClick={() => { setUndo(units.map((u) => ({ ...u }))); setUnits(units.map((u) => ({ ...u, cell: -1 }))); setSel(null); setMsg('모두 내렸습니다 · 되돌리기 가능'); }}>모두 내리기</button>
                {undo && <button type="button" className="sb-btn sm ghost" onClick={undoFormation}>되돌리기</button>}
            </div>
            <div className="sb-fmsg">{msg}</div>
            {selUnit && <div className="sb-info"><div><b>{selUnit.def.name}</b> <span style={{ color: RARITY_COLOR[selUnit.rarity] }}>{RARITY_NAME[selUnit.rarity]}</span> · {selUnit.def.role} · Lv{selUnit.lv}<br />체력 {Math.round(selUnit.def.hp * unitMult(selUnit))} 공격 {Math.round(selUnit.def.atk * unitMult(selUnit))}{selUnit.def.heal ? ` 치유 ${Math.round(selUnit.def.heal * unitMult(selUnit))}` : ''} · {selUnit.cell >= 0 ? '칸을 눌러 이동·교체' : '칸을 눌러 배치'}</div>
                {selUnit.cell >= 0 && <div className="sb-acts"><button type="button" className="sb-btn sm ghost" onClick={() => unplace(selUnit.uid)}>내리기</button></div>}</div>}
            <div className="sb-flist">{[...units].sort((a, b) => unitPower(b) - unitPower(a)).map((u) => <button type="button" key={u.uid} className={`sb-fu${sel === u.uid ? ' is-sel' : ''}${u.cell >= 0 ? ' on' : ''}`} style={{ borderColor: RARITY_COLOR[u.rarity] }} onClick={() => setSel(sel === u.uid ? null : u.uid)}>
                <Icon sheet={u.def.sheet} ready={ready} lv={u.lv} /><span>{'★'.repeat(u.lv)}{u.enh ? ` +${u.enh}` : ''}</span><small>{u.cell >= 0 ? '출전' : u.def.role}</small>
            </button>)}{!units.length && <span className="sb-empty">보유 유닛이 없습니다. 소환하세요</span>}</div>
        </div>}
        {map && <div className="sb-map" role="dialog" aria-label="지역">
            <div className="sb-maphead"><b>지역</b><button type="button" className="sb-btn sm ghost" onClick={() => setMap(false)}>닫기</button></div>
            {REGIONS.map((r, ri) => {
                const done = Array.from({ length: STAGES_PER_REGION }, (_, k) => cleared[`${r.id}-${k + 1}`]).filter(Boolean).length;
                return <div key={r.id} className={`sb-reg${ri === region ? ' cur' : ''}${r.ready ? '' : ' lock'}`}>
                    <div className="sb-reghead"><b>{r.id} {r.name}</b>{r.temp && <small className="sb-temp">개발중 · 임시 보스</small>}{r.ready && <span className="sb-regprog">{done}/{STAGES_PER_REGION}</span>}</div>
                    {r.ready ? <div className="sb-dots">{Array.from({ length: STAGES_PER_REGION }, (_, k) => {
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
            <button type="button" className="sb-btn sm ghost" onClick={resetAll}>진행 초기화</button>
            <p className="sb-credit">스프라이트: LuizMelo 팩(Hero Knight 1-2, Fantasy Warrior, Medieval Warrior 1-3, Medieval King 1-2, Martial Hero 1-3, Huntress 1-2, Evil Wizard 1-3, Fire Worm, Monsters Creatures Fantasy 1-2), Wizard Pack. 보스(3-8지역): chierit (CC-BY 4.0) — Boss: Demon Slime, Boss: Frost Guardian, Free Cthulhu, Elementals: Crystal Mauler / Fire Knight / Wind Hashashin (chierit.itch.io). 배경: 8개 지역 모두 AI 생성(쿼터뷰 전장 배경).</p>
        </div>}
    </div>;
}
