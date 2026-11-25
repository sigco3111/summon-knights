import React from 'react';

export interface Stats { bw: number; bl: number; sp: number; ce: number; kl: number; ps: number; bs: number; cs: number; sc: Record<string, number>; since: number; cy: Record<string, CyRec>; }
export interface CyRec { bw: number; bl: number; ce: number; ps: number; sp: number; kl: number; }
const CYK: (keyof CyRec)[] = ['bw', 'bl', 'ce', 'ps', 'sp', 'kl'];
export function addCy(old: Stats, nw: Stats, cycle: number): Stats {
    const k = String(cycle); const cur: CyRec = { ...(nw.cy?.[k] || { bw: 0, bl: 0, ce: 0, ps: 0, sp: 0, kl: 0 }) }; let ch = false;
    for (const f of CYK) { const dlt = (nw[f] as number) - (old[f] as number); if (dlt > 0) { cur[f] += dlt; ch = true; } }
    return ch ? { ...nw, cy: { ...(nw.cy || {}), [k]: cur } } : nw;
}
export const emptyStats = (): Stats => ({ bw: 0, bl: 0, sp: 0, ce: 0, kl: 0, ps: 0, bs: 0, cs: 0, sc: {}, since: Date.now(), cy: {} });
export function normStats(q: unknown): Stats {
    const e = emptyStats(); if (!q || typeof q !== 'object') return e;
    const o = q as Record<string, unknown>; const n = (k: string) => Math.max(0, Math.floor(Number(o[k]) || 0));
    const sc: Record<string, number> = {}; if (o.sc && typeof o.sc === 'object') for (const [k, v] of Object.entries(o.sc as Record<string, unknown>)) { const c = Math.max(0, Math.floor(Number(v) || 0)); if (c) sc[k] = c; }
    const cy: Record<string, CyRec> = {}; if (o.cy && typeof o.cy === 'object') for (const [k, v] of Object.entries(o.cy as Record<string, unknown>)) { if (!v || typeof v !== 'object') continue; const r = v as Record<string, unknown>; const g = (f: string) => Math.max(0, Math.floor(Number(r[f]) || 0)); cy[k] = { bw: g('bw'), bl: g('bl'), ce: g('ce'), ps: g('ps'), sp: g('sp'), kl: g('kl') }; }
    return { bw: n('bw'), bl: n('bl'), sp: n('sp'), ce: n('ce'), kl: n('kl'), ps: n('ps'), bs: n('bs'), cs: n('cs'), sc, since: n('since') || Date.now(), cy };
}
const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}시간 ${m}분` : `${m}분`; };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

interface DU { rarity: number; lv: number; abs?: number; off?: boolean; def: { role: string; name: string } }
interface Props {
    stats: Stats; cleared: Record<string, boolean>; units: DU[]; cycle: number; cores: number; ups: number; diff: string;
    regions: { id: number | string; name: string; ready?: boolean }[]; perRegion: number; rarityName: string[]; rarityColor: string[]; onClose: () => void;
}
export function Dashboard(p: Props) {
    const { stats, cleared, units, regions, perRegion } = p;
    const battles = stats.bw + stats.bl; const wr = pct(stats.bw, battles);
    const totalDone = regions.reduce((a, r) => a + Array.from({ length: perRegion }, (_, k) => cleared[`${r.id}-${k + 1}`]).filter(Boolean).length, 0);
    const totalAll = regions.length * perRegion;
    const rc = [0, 1, 2].map((r) => units.filter((u) => u.rarity === r).length);
    const roles: Record<string, number> = {}; units.forEach((u) => { roles[u.def.role] = (roles[u.def.role] || 0) + 1; });
    const roleList = Object.entries(roles).sort((a, b) => b[1] - a[1]);
    const top = [...units].sort((a, b) => (b.abs || 1) - (a.abs || 1) || b.lv - a.lv).slice(0, 5);
    const maxAbs = Math.max(1, ...top.map((u) => u.abs || 1));
    const maxSc = Math.max(1, ...Object.values(stats.sc));
    const R = 34, C = 2 * Math.PI * R; const winLen = battles ? (stats.bw / battles) * C : 0;
    const card = (k: string, v: string, sub?: string) => <div className="dash-card" key={k}><small>{k}</small><b>{v}</b>{sub && <em>{sub}</em>}</div>;
    return <div className="sb-map dash" role="dialog" aria-label="통계 대시보드">
        <div className="sb-maphead"><b>통계 대시보드</b><button type="button" className="sb-btn sm ghost" onClick={p.onClose}>닫기</button></div>
        <div className="dash-grid">
            {card('플레이 시간', fmtTime(stats.ps), '이 기기 기준')}
            {card('전투', `${battles}회`, `승 ${stats.bw} / 패 ${stats.bl}`)}
            {card('소환', `${stats.sp}회`)}
            {card('획득 코인', `${stats.ce}`, '전투 보상 합계')}
            {card('처치 수', `${stats.kl}`)}
            {card('최고 연승', `${stats.bs}연승`, `현재 ${stats.cs}연승`)}
        </div>
        <div className="dash-sec"><b>승률</b>
            <div className="dash-donutrow">
                <svg width="88" height="88" viewBox="0 0 88 88" aria-label={`승률 ${wr}%`}><circle cx="44" cy="44" r={R} fill="none" stroke="#b9876a" strokeWidth="12" /><circle cx="44" cy="44" r={R} fill="none" stroke="#4cae6a" strokeWidth="12" strokeDasharray={`${winLen} ${C}`} transform="rotate(-90 44 44)" /><text x="44" y="49" textAnchor="middle" fontSize="16" fill="#2b1d0a" fontWeight="700">{battles ? `${wr}%` : '-'}</text></svg>
                <div><div><i className="dash-dot" style={{ background: '#4cae6a' }} />승리 {stats.bw}</div><div><i className="dash-dot" style={{ background: '#b9876a' }} />패배 {stats.bl}</div><small>패배는 비용이 없습니다 (코인 +1)</small></div>
            </div>
        </div>
        <div className="dash-sec"><b>회차별 기록 (현재 {p.cycle}회차)</b>
            {Array.from({ length: p.cycle }, (_, i) => i + 1).map((c) => { const r = stats.cy[String(c)]; const n = r ? r.bw + r.bl : 0; return <div className="dash-bar" key={c} style={{ display: 'block' }}>{r ? <span><b>{c}회차</b> 전투 {n}회 (승 {r.bw} / 패 {r.bl}, 승률 {pct(r.bw, n)}%) · 코인 {r.ce} · 소환 {r.sp} · 처치 {r.kl} · {fmtTime(r.ps)}</span> : <span><b>{c}회차</b> 기록 없음 (회차별 집계 시작 전)</span>}</div>; })}
            <small>회차별 집계는 이번 업데이트 이후 전투부터 쌓입니다. 이전 회차 수치는 만들어 넣지 않습니다.</small>
        </div>
        <div className="dash-sec"><b>{p.cycle}회차 지역 진행 ({totalDone}/{totalAll}, 회차 시작 시 초기화)</b>
            {regions.filter((r) => r.ready !== false).map((r) => { const d = Array.from({ length: perRegion }, (_, k) => cleared[`${r.id}-${k + 1}`]).filter(Boolean).length; return <div className="dash-bar" key={r.id}><span>{r.id} {r.name}</span><div><i style={{ width: `${pct(d, perRegion)}%` }} /></div><em>{d}/{perRegion}</em></div>; })}
        </div>
        <div className="dash-sec"><b>전투별 누적 승리 횟수 (모든 회차 합산, 통계 집계 후)</b>
            <div className="dash-heat">{regions.filter((r) => r.ready !== false).map((r) => <div key={r.id} className="dash-hrow"><span>{r.id}</span>{Array.from({ length: perRegion }, (_, k) => { const c = stats.sc[`${r.id}-${k + 1}`] || 0; const done = !!cleared[`${r.id}-${k + 1}`]; return <i key={k} title={`${r.id}-${k + 1}: ${c}회 승리`} className={done ? 'on' : ''} style={c ? { opacity: 0.45 + 0.55 * (c / maxSc) } : undefined}>{c || (done ? '✓' : '')}</i>; })}</div>)}</div>
            <small>숫자는 이 통계가 켜진 뒤의 승리 횟수, ✓는 현재 회차에서 클리어한 단계입니다.</small>
        </div>
        <div className="dash-sec"><b>보유 유닛 {units.length}기</b>
            <div className="dash-stack">{rc.map((c, i) => c ? <i key={i} style={{ flex: c, background: p.rarityColor[i] }} title={`${p.rarityName[i]} ${c}`}>{p.rarityName[i]} {c}</i> : null)}</div>
            <div className="dash-chips">{roleList.map(([k, v]) => <span key={k}>{k} {v}</span>)}</div>
        </div>
        <div className="dash-sec"><b>흡수 레벨 상위 5기</b>
            {top.length === 0 ? <small>유닛 없음</small> : top.map((u, i) => <div className="dash-bar" key={i}><span>{u.def.name}</span><div><i style={{ width: `${((u.abs || 1) / maxAbs) * 100}%`, background: p.rarityColor[u.rarity] }} /></div><em>흡수 Lv {u.abs || 1}</em></div>)}
        </div>
        <div className="dash-sec"><b>현재 상태</b><div className="dash-chips"><span>난이도 {p.diff}</span><span>코어 {p.cores}</span><span>강화 {p.ups}</span><span>{p.cycle}회차</span></div></div>
        <small className="dash-note">통계 집계 시작: {new Date(stats.since).toLocaleDateString('ko-KR')}. 그 이전 전투(전투 수·소환 수·획득 코인·처치 수)는 기록되지 않았고, 지역 진행·유닛 정보는 저장된 현재 상태에서 읽습니다. 개발중·임시 화면입니다.</small>
    </div>;
}
