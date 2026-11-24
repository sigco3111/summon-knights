// 성장경제 모의: 탐욕 봇이 56전투를 순서대로 진행. 실전 전투 코드 사용. 봇 정책은 단순(추천 아님).
const g = require('/tmp/game.cjs');
const SC = 3; let uid = 1;
function merge(list){let cur=list.slice();for(let k=0;k<30;k++){let did=false;
 for(const d of g.ALLIES)for(const r of [0,1,2])for(let lv=1;lv<3;lv++){const G=cur.filter(u=>u.def.id===d.id&&u.rarity===r&&u.lv===lv);
  if(G.length>=3){G.sort((a,b)=>b.cell-a.cell);const keep=G[0];const rm=new Set([G[0].uid,G[1].uid,G[2].uid]);const enh=Math.max(G[0].enh,G[1].enh,G[2].enh);
  cur=cur.filter(u=>!rm.has(u.uid));cur.push({...keep,uid:uid++,lv:lv+1,enh});did=true;break;}}
 if(!did)break;}return cur;}
const pw=u=>g.unitMult(u)*(u.def.hp*0.05+u.def.atk);
function place(units){const s=units.slice().sort((a,b)=>pw(b)-pw(a));s.forEach(u=>u.cell=-1);
 const field=s.slice(0,6);const col={'전열':2,'딜러':1,'원거리':0,'지원':0};const used=new Set();
 for(const u of field){const c0=col[u.def.role];for(const c of [c0,1,0,2]){let ok=false;for(const r of [1,0,2]){const cell=r*3+c;if(!used.has(cell)){used.add(cell);u.cell=cell;ok=true;break;}}if(ok)break;}}}
function run(){let coins=12,shards=0,units=[];const log={summons:0,stuck:null,clears:0,decomp:0,enh:0};
 for(let rid=0;rid<8;rid++)for(let si=0;si<7;si++){const stage=g.buildStage(g.REGIONS[rid],si);let tries=0;
  while(true){
   while(coins>=SC&&log.summons<400){coins-=SC;log.summons++;const made=[0,1,2].map(()=>({uid:uid++,def:g.rollUnit(),rarity:g.rollRarity(),cell:-1,lv:1,enh:0}));units=merge([...units,...made]);}
   place(units);
   // 벤치 정리: 출전 외 유닛이 8개 넘으면 약한 순 분해
   const bench=units.filter(u=>u.cell<0).sort((a,b)=>pw(a)-pw(b));
   while(bench.length>8){const u=bench.shift();shards+=g.shardValue(u);log.decomp++;units=units.filter(x=>x.uid!==u.uid);}
   for(let k=0;k<50;k++){const f=units.filter(u=>u.cell>=0&&u.enh<5).sort((a,b)=>a.enh-b.enh)[0];if(!f||shards<g.enhCost(f))break;shards-=g.enhCost(f);f.enh++;log.enh++;}
   const b=g.startBattle(units.filter(u=>u.cell>=0),stage);let n=0;while(!b.result&&n++<20000)g.step(b,50);
   if(b.result==='win'){coins+=stage.reward;log.clears++;break;}
   coins+=1;tries++;if(tries>=12){log.stuck=stage.label;return log;}
  }}
 return log;}
const N=parseInt(process.argv[2]||'20',10);const R=[];for(let i=0;i<N;i++)R.push(run());
const st={};R.forEach(r=>{const k=r.stuck||'완주';st[k]=(st[k]||0)+1;});
console.log('막힘 지점 분포(N='+N+')',JSON.stringify(st));
const avg=k=>(R.reduce((a,r)=>a+r[k],0)/N).toFixed(1);
console.log('평균 클리어',avg('clears'),'/56 소환',avg('summons'),'분해',avg('decomp'),'강화',avg('enh'));
