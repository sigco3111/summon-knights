// 전체 루프 시뮬레이션(실제 game.ts 전투/슬롯 코드). 봇 정책: 준비 중 코인 소진까지 소환, 전투 중 1.5초마다 소환, 승리 시 공격 강화 선택, 승급은 공격 분기 자동.
// 코어는 반영하지 않음(보수적). 난이도 증명이 아니라 병목 탐색용.
const g = require('/tmp/game.cjs');
const N = parseInt(process.argv[2] || '20', 10), MAXTRY = 6;
let uid = 1;
function spinOnce(S) {
  const cost = 1 + Math.min(3, Math.floor(S.spins / 3));
  if (S.coins < cost || S.units.length >= 30) return false;
  S.coins -= cost; S.spins++;
  const gr = Array.from({ length: 9 }, () => g.rollCell());
  const ev = g.evalGrid(gr); S.lastLines = ev.wins.filter((w) => w.kind === 'line').length;
  if (!ev.units && !ev.shards) { S.coins += 1; return true; }
  S.coins += Math.round(ev.shards * 0.6);
  const made = [];
  for (const w of ev.wins) if (w.kind === 'line') for (let k = 0; k < g.LINE_SUMMON; k++) { const p = g.rollSymbolUnit(gr[w.cells[0]].u); made.push({ uid: uid++, def: p.def, rarity: p.r, cell: -1, lv: 1, enh: 0, abs: 1 }); }
  const entered = [];
  for (const mu of made) {
    if (S.units.filter((x) => !x.off).length < 8) { S.units.push(mu); entered.push(mu); continue; }
    const t = S.units.filter((x) => !x.off && x.def.id === mu.def.id).sort((a, b) => b.abs - a.abs)[0];
    if (t) { t.abs += 1 + Math.floor(mu.abs / 3) + mu.rarity + 1; t.lv = Math.max(t.lv, g.starOf(t.rarity, t.abs)); if (t.lv >= 2 && !t.promo) t.promo = 2; if (t.lv >= 3 && !t.promo2) t.promo2 = 2; }
    else { mu.off = true; S.units.push(mu); }
  }
  return entered;
}
function runStage(S, stage) {
  const board = S.units.filter((u) => !u.off);
  const b = g.startBattle(board, stage, false, [], S.ups); let guard = 0, since = 0, lootA = 0;
  while (!b.result && guard++ < 60000) {
    g.step(b, 50); since += 50; if (b.loot > lootA) { S.coins += b.loot - lootA; lootA = b.loot; }
    if (since >= (+process.env.SPIN_MS || 1500)) { since = 0; const e = spinOnce(S); if (Array.isArray(e)) { if (process.env.SURGE && S.lastLines) g.lineSurge(b, S.lastLines); const on = S.units.filter((x) => !x.off); e.forEach((u) => g.addAllyToBattle(b, u, on, [], S.ups)); } }
  }
  return b.result === 'win';
}
const stuck = Array(56).fill(0), reached = Array(56).fill(0), tries = Array(56).fill(0);
for (let n = 0; n < N; n++) {
  const S = { coins: 12, units: [], ups: [], spins: 0 };
  for (let gi = 0; gi < 56; gi++) {
    const reg = g.REGIONS[Math.floor(gi / 7)], idx = gi % 7, stage = g.buildStage(reg, idx); if (process.env.K) { const kind = stage.kind; stage.mult = (1 + gi * +process.env.K + (kind === '보스' ? 0.4 : 0)) * (kind === '정예' ? 1.08 : 1); }
    let ok = false;
    for (let t = 0; t < MAXTRY && !ok; t++) {
      tries[gi]++; S.spins = 0;
      while (spinOnce(S)) { if (S.units.length >= 30) break; if (S.coins < 1) break; }
      ok = runStage(S, stage);
      if (!ok) S.coins += 1;
    }
    if (!ok) { stuck[gi]++; break; }
    reached[gi]++; S.coins += stage.reward + 2 * S.ups.filter((x) => x === 'loot').length; S.ups.push('atk');
  }
}
let out = '';
for (let gi = 0; gi < 56; gi++) out += `${Math.floor(gi / 7) + 1}-${gi % 7 + 1}: clear ${reached[gi]}/${N} stuck ${stuck[gi]} avgTries ${(tries[gi] / Math.max(1, reached[gi] + stuck[gi])).toFixed(1)}\n`;
console.log(out);
