import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalState } from '@instinct/files';
import { FxLayer } from './fxlayer';
import grotto from './photos/grotto.png';
import bgforest from './photos/forest.png';
import bgcanopy from './photos/canopy.png';
import bgtundra from './photos/tundra.png';
import bghollow from './photos/hollow.png';
import bgmesa from './photos/mesa.png';
import bgkiln from './photos/kiln.png';
import bgsodium from './photos/sodium.png';
const BG_SRC: Record<string, string> = { grotto, forest: bgforest, canopy: bgcanopy, tundra: bgtundra, hollow: bghollow, mesa: bgmesa, kiln: bgkiln, sodium: bgsodium };
import {
    ALLIES, REGIONS, RARITY_NAME, RARITY_COLOR, STAGES_PER_REGION, W, H, MAX_LV, MAX_ENH, buildStage, cellPos, drawBattle, iconDraw, allUrls, registerImg,
    rollRarity, rollUnit, startBattle, step, synergy, synergyBonus, unitMult, enhCost, shardValue, type Battle, type Unit,
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
    const [phase, setPhase] = useState<'prep' | 'battle' | 'win' | 'lose'>('prep');
    const [reels, setReels] = useState<(number | null)[]>([null, null, null]);
    const [spinning, setSpinning] = useState(false);
    const [msg, setMsg] = useState('소환해서 유닛을 배치하세요');
    const [kills, setKills] = useState<[number, number]>([0, 0]);
    const [map, setMap] = useState(false);
    const fxRef = useRef<FxLayer | null>(null); if (!fxRef.current && typeof document !== 'undefined') fxRef.current = new FxLayer(W, H);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const battleRef = useRef<Battle | null>(null);
    const bgsRef = useRef<Record<string, HTMLImageElement>>({});
    const unitsRef = useRef<Unit[]>([]); unitsRef.current = units;
    const phaseRef = useRef(phase); phaseRef.current = phase;
    const regionRef = useRef(region); regionRef.current = region;
    const urls = useRef(allUrls()).current; const loaded = useRef(0);
    const onImg = (u: string, el: HTMLImageElement) => { registerImg(u, el); loaded.current++; if (loaded.current >= urls.length + 1) setReady(true); };

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
            if (c) { const ctx = c.getContext('2d'); if (ctx) drawBattle(ctx, b, unitsRef.current.filter((u) => u.cell >= 0), bgsRef.current, REGIONS[regionRef.current].bg, null); fxRef.current?.draw(ctx); }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [ready]);

    const summon = useCallback(() => {
        if (spinning || phase === 'battle' || coins < SUMMON_COST) return;
        setCoins((c) => c - SUMMON_COST); setSpinning(true); setSel(null);
        const picks = [0, 1, 2].map(() => ({ def: rollUnit(), r: rollRarity() }));
        let tick = 0;
        const iv = setInterval(() => {
            tick++;
            setReels([0, 1, 2].map((i) => (tick > 4 + i * 2 ? ALLIES.indexOf(picks[i].def) : Math.floor(Math.random() * ALLIES.length))));
            if (tick > 4 + 2 * 2 + 1) {
                clearInterval(iv);
                const made: Unit[] = picks.map((p) => ({ uid: uidSeq++, def: p.def, rarity: p.r as 0 | 1 | 2, cell: -1, lv: 1, enh: 0 }));
                setUnits((u) => { const r = mergeAll([...u, ...made]); setMsg(r.merged.length ? `합성! ${r.merged.join(', ')}` : `소환: ${made.map((m) => m.def.name).join(', ')}`); return r.list; });
                setSpinning(false);
            }
        }, 110);
    }, [spinning, phase, coins]);

    const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (phase === 'battle') return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W; const y = ((e.clientY - r.top) / r.height) * H;
        let cell = -1;
        for (let c = 0; c < 9; c++) { const p = cellPos(c); if (Math.abs(x - p.x) < 22 && y > p.y - 50 && y < p.y + 12) cell = c; }
        if (cell < 0) return;
        const here = units.find((u) => u.cell === cell);
        if (sel !== null) {
            if (here) setUnits(units.map((u) => (u.uid === here.uid ? { ...u, cell: -1 } : u.uid === sel ? { ...u, cell } : u)));
            else if (board.length >= MAX_BOARD) { setMsg(`출전은 최대 ${MAX_BOARD}명. 배치된 유닛을 눌러 내리세요`); return; }
            else setUnits(units.map((u) => (u.uid === sel ? { ...u, cell } : u)));
            { const pp = cellPos(cell); fxRef.current?.add({ k: 'death', x: pp.x, y: pp.y - 6, flip: false }); }
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
        <div className="sb-hidden" aria-hidden="true">{urls.map((u) => <img key={u} src={u} alt="" onLoad={(e) => onImg(u, e.currentTarget)} />)}{Object.entries(BG_SRC).map(([k, src]) => <img key={k} src={src} alt="" onLoad={(e) => { bgsRef.current[k] = e.currentTarget; onImg(`bg:${k}`, e.currentTarget); }} />)}</div>
        <div className="sb-top">
            <button type="button" className="sb-stage" onClick={() => setMap(true)} disabled={phase === 'battle'}><b>{reg.id} {reg.name}</b><span>{stage.label} {stage.kind}</span></button>
            <div className="sb-res"><span className="sb-coin" title="소환 코인">●</span><b>{coins}</b><span className="sb-shard" title="강화 조각">◆</span><b>{shards}</b></div>
        </div>
        <div className={`sb-save${saved.ready ? '' : ' warn'}`} role="status">{saved.ready ? (/not saved/i.test(saved.message || '') ? '저장 불가: 창을 닫으면 진행이 사라집니다. 지역 메뉴의 저장 코드를 보관하세요.' : '이 기기에 자동 저장됩니다.') + (saved.message ? ` (${saved.message})` : '') : '저장 상태 확인 중'}</div>
        <div className="sb-field">
            <canvas ref={canvasRef} width={W} height={H} className="sb-canvas" onPointerDown={onCanvas} aria-label="전장" />
            {phase === 'battle' && <div className="sb-prog"><i style={{ width: `${kills[1] ? (kills[0] / kills[1]) * 100 : 0}%` }} /><span>{kills[0]}/{kills[1]}</span></div>}
            {(phase === 'win' || phase === 'lose') && <div className={`sb-result ${phase}`}>{phase === 'win' ? '승리' : '패배'}<small>{msg}</small></div>}
            {!ready && <div className="sb-result">불러오는 중</div>}
        </div>
        <div className="sb-syn">
            {ROLES.map((r) => <span key={r} className={syn[r] ? 'on' : ''}>{r} {syn[r] || 0}{synergyBonus(syn[r] || 0) ? <em>+{Math.round(synergyBonus(syn[r]) * 100)}%</em> : null}</span>)}
            <span className="cnt">출전 {board.length}/{MAX_BOARD}</span>
        </div>
        {phase !== 'win' && phase !== 'lose' && <div className="sb-msg">{msg}</div>}
        <div className="sb-slot">
            <div className="sb-reels">{reels.map((r, i) => <div key={i} className={`sb-reel${spinning ? ' is-spin' : ''}`}>{r === null ? <span>?</span> : <Icon sheet={ALLIES[r].sheet} ready={ready} />}</div>)}</div>
            <button type="button" className="sb-btn sb-summon" disabled={spinning || phase === 'battle' || coins < SUMMON_COST || !ready || !saved.ready} onClick={summon}>소환<small>● {SUMMON_COST}</small></button>
        </div>
        <div className="sb-bench">
            {bench.length === 0 && <span className="sb-empty">벤치 비어 있음</span>}
            {bench.map((u) => <button type="button" key={u.uid} className={`sb-unit${sel === u.uid ? ' is-sel' : ''}`} style={{ borderColor: RARITY_COLOR[u.rarity] }} onClick={() => setSel(sel === u.uid ? null : u.uid)}>
                <Icon sheet={u.def.sheet} ready={ready} lv={u.lv} /><span className="sb-lv">{'★'.repeat(u.lv)}{u.enh ? ` +${u.enh}` : ''}</span><small>{u.def.role}</small>
            </button>)}
        </div>
        {selUnit && <div className="sb-info">
            <div><b>{selUnit.def.name}</b> <span style={{ color: RARITY_COLOR[selUnit.rarity] }}>{RARITY_NAME[selUnit.rarity]}</span> · {selUnit.def.role} · Lv{selUnit.lv}<br />체력 {Math.round(selUnit.def.hp * unitMult(selUnit))} 공격 {Math.round(selUnit.def.atk * unitMult(selUnit))}{selUnit.def.heal ? ` 치유 ${Math.round(selUnit.def.heal * unitMult(selUnit))}` : ''} · 칸을 눌러 배치</div>
            <div className="sb-acts"><button type="button" className="sb-btn sm" onClick={enhance} disabled={selUnit.enh >= MAX_ENH}>강화 ◆{selUnit.enh >= MAX_ENH ? '최대' : enhCost(selUnit)}</button><button type="button" className="sb-btn sm ghost" onClick={decompose}>분해 +◆{shardValue(selUnit)}</button></div>
        </div>}
        <div className="sb-bar">
            {phase === 'prep' && <button type="button" className="sb-btn go" disabled={!ready || !reg.ready} onClick={startFight}>전투 시작</button>}
            {phase === 'battle' && <button type="button" className="sb-btn go" disabled>전투 중</button>}
            {phase === 'win' && <><button type="button" className="sb-btn go" onClick={next}>다음 전투</button><button type="button" className="sb-btn ghost" onClick={() => toPrep()}>정비</button></>}
            {phase === 'lose' && <button type="button" className="sb-btn go" onClick={() => toPrep()}>다시 준비</button>}
        </div>
        {map && <div className="sb-map" role="dialog" aria-label="지역">
            <div className="sb-maphead"><b>지역</b><button type="button" className="sb-btn sm ghost" onClick={() => setMap(false)}>닫기</button></div>
            {REGIONS.map((r, ri) => <div key={r.id} className={`sb-reg${ri === region ? ' cur' : ''}${r.ready ? '' : ' lock'}`}>
                <b>{r.id} {r.name}</b>{r.temp && <small className="sb-temp">개발중 · 임시 보스</small>}
                {r.ready ? <div className="sb-dots">{Array.from({ length: STAGES_PER_REGION }, (_, k) => <button type="button" key={k} className={cleared[`${r.id}-${k + 1}`] ? 'done' : ''} onClick={() => goStage(ri, k)}>{k === STAGES_PER_REGION - 1 ? '보' : k === STAGES_PER_REGION - 2 ? '정' : k + 1}</button>)}</div> : <small>잠김 · {r.need}</small>}
            </div>)}
            <div className="sb-xfer"><b>저장 코드</b><small>자동 저장이 안 되는 환경에서는 코드를 복사해 보관하세요.</small>
                <textarea value={xfer} onChange={(e) => setXfer(e.target.value)} rows={3} aria-label="저장 코드" />
                <div><button type="button" className="sb-btn sm ghost" onClick={exportSave}>내보내기</button> <button type="button" className="sb-btn sm ghost" onClick={importSave} disabled={phase === 'battle' || !xfer}>불러오기</button></div></div>
            <button type="button" className="sb-btn sm ghost" onClick={resetAll}>진행 초기화</button>
            <p className="sb-credit">스프라이트: LuizMelo 팩(Hero Knight 1-2, Fantasy Warrior, Medieval Warrior 1-3, Medieval King 1-2, Martial Hero 1-3, Huntress 1-2, Evil Wizard 1-3, Fire Worm, Monsters Creatures Fantasy 1-2), Wizard Pack. 보스(3-8지역): chierit (CC-BY 4.0) — Boss: Demon Slime, Boss: Frost Guardian, Free Cthulhu, Elementals: Crystal Mauler / Fire Knight / Wind Hashashin (chierit.itch.io). 배경: Super Grotto Escape(ansimuz, CC0), Dark Forest, VISTA-ten.</p>
        </div>}
    </div>;
}
