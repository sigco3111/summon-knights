const g=require('/tmp/game.cjs'),A=require('/tmp/mergeapp.cjs');
// econ-sim의 merge를 복제하지 않고 파일에서 추출
const src=require('fs').readFileSync('/tmp/sk-repo/tools/econ-sim.cjs','utf8');
const m=src.match(/function merge\(list\)[\s\S]*?return cur;}/)[0];
let uid=5000;const merge=new Function('g',m.replace('function merge(list){','let uid=9000;function merge(list){')+';return merge;')(g);
// uid는 지역변수 사용이므로 비교는 uid 제외 요약
const sig=l=>l.map(u=>[u.def.id,u.rarity,u.lv,u.enh,u.cell].join()).sort().join('|');
let bad=0;const N=2000;
for(let t=0;t<N;t++){const n=3+Math.floor(Math.random()*20);const l=[];for(let i=0;i<n;i++)l.push({uid:i+1,def:g.ALLIES[Math.floor(Math.random()*4)],rarity:Math.floor(Math.random()*2),cell:Math.floor(Math.random()*10)-1,lv:1+(Math.random()<0.2?1:0),enh:Math.floor(Math.random()*4)});
 const a=A.mergeAll(l.map(x=>({...x}))).list,b=(()=>{let u=1;try{return merge(l.map(x=>({...x})))}catch(e){return null}})();
 if(!b||sig(a)!==sig(b))bad++;}
console.log('불일치',bad,'/',N);
for(let t=0;t<3000;t++){const n=3+Math.floor(Math.random()*8);const l=[];for(let i=0;i<n;i++)l.push({uid:i+1,def:g.ALLIES[Math.floor(Math.random()*2)],rarity:0,cell:Math.floor(Math.random()*10)-1,lv:1,enh:Math.floor(Math.random()*4)});
 const a=A.mergeAll(l.map(x=>({...x}))).list,b=merge(l.map(x=>({...x})));
 if(sig(a)!==sig(b)){console.log('IN',sig(l));console.log('APP',sig(a));console.log('SIM',sig(b));break;}}
for(let t=0;t<5000;t++){const n=3+Math.floor(Math.random()*10);const l=[];for(let i=0;i<n;i++)l.push({uid:i+1,def:g.ALLIES[Math.floor(Math.random()*2)],rarity:Math.floor(Math.random()*2),cell:Math.floor(Math.random()*10)-1,lv:1+(Math.random()<0.3?1:0),enh:Math.floor(Math.random()*4)});
 const a=A.mergeAll(l.map(x=>({...x}))).list,b=merge(l.map(x=>({...x})));
 if(sig(a)!==sig(b)){console.log('IN',sig(l));console.log('APP',sig(a));console.log('SIM',sig(b));break;}}
