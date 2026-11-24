const g=require('/tmp/game.cjs');
const mk=(i,ai,cell)=>({uid:i,def:g.ALLIES[ai],rarity:0,lv:1,enh:0,cell});
const st=g.buildStage(g.REGIONS[0],3);
function run(units){let atk={},dmg=0;const N=20;for(let k=0;k<N;k++){const b=g.startBattle(units.map(u=>({...u})),st);const prev={};let n=0;while(!b.result&&n++<20000){g.step(b,50);for(const f of b.fighters){if(f.team!=='a')continue;const was=prev[f.key];if(f.state==='atk'&&was!=='atk')atk[f.key]=(atk[f.key]||0)+1;prev[f.key]=f.state}}}
 return Object.fromEntries(Object.entries(atk).map(([k,v])=>[k,(v/N).toFixed(1)]))}
console.log('dealer col index def:',g.ALLIES[2].name,g.ALLIES[2].role,g.ALLIES[2].range);
console.log('tank col2 + 딜러 col1 (현재 규칙):',JSON.stringify(run([mk(1,0,5),mk(2,2,4),mk(3,0,8)])));
console.log('tank col2 + 딜러 col2 같은 열:',JSON.stringify(run([mk(1,0,5),mk(2,2,2),mk(3,0,8)])));
console.log('tank col2 + 딜러 col0:',JSON.stringify(run([mk(1,0,5),mk(2,2,3),mk(3,0,8)])));
