const g = require('/tmp/game.cjs');
// profiles: [allyIdx, rarity, lv, enh, cell]
const PROFILES = {
  fresh3: [[0,0,1,0,2],[3,0,1,0,1],[4,0,1,0,0]],
  early6: [[0,0,1,0,2],[5,0,1,0,5],[8,0,1,0,8],[3,0,1,0,1],[13,0,1,0,4],[4,0,1,0,0]],
  mid:    [[0,1,2,2,2],[5,1,2,2,5],[8,1,2,2,8],[3,1,2,2,1],[13,1,2,2,4],[4,1,2,2,0]],
  maxed:  [[0,2,3,5,2],[5,2,3,5,5],[8,2,3,5,8],[3,2,3,5,1],[13,2,3,5,4],[4,2,3,5,0]],
  mid_d:  [[0,1,2,2,2],[8,1,2,2,8],[12,1,2,2,5],[11,1,2,2,4],[3,1,2,2,1],[4,1,2,2,0]],
  maxed_d:[[0,2,3,5,2],[8,2,3,5,8],[12,2,3,5,5],[11,2,3,5,4],[3,2,3,5,1],[4,2,3,5,0]],
};
function mkUnits(spec) {
  return spec.map(([ai, r, lv, enh, cell], i) => ({ uid: i+1, def: g.ALLIES[ai], rarity: r, lv, enh, cell }));
}
function runOnce(units, stage) {
  const b = g.startBattle(units, stage);
  let guard = 0;
  while (!b.result && guard++ < 20000) g.step(b, 50);
  return b.result || 'timeout';
}
const [,, r0s, r1s, ns] = process.argv;
const N = parseInt(ns || '40', 10);
// deterministic-ish seeding not available for Math.random; rely on N
for (let rid = parseInt(r0s||'1',10); rid <= parseInt(r1s||'8',10); rid++) {
  for (let si = 0; si < 7; si++) {
    const stage = g.buildStage(g.REGIONS[rid-1], si);
    const out = [];
    for (const p of (process.env.P||'fresh3,early6,mid,maxed').split(',')) {
      let w = 0;
      for (let i = 0; i < N; i++) if (runOnce(mkUnits(PROFILES[p]), stage) === 'win') w++;
      out.push(`${p} ${Math.round(w*100/N)}%`);
    }
    console.log(`${rid}-${si+1} [${stage.kind} x${stage.mult.toFixed(2)} n${stage.spawns.length}]`, out.join(' '));
  }
}
