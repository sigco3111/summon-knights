#!/usr/bin/env python3
"""Faithful port of summon-knights game.ts battle (gen9 source)."""
import math, random, sys

W, H = 360, 250
CELL_X = [42, 94, 146]
CELL_Y = [150, 184, 218]
ATK_MS, HIT_MS = 560, 260
RARITY_MULT = [1, 1.35, 1.8]

ALLIES = [
    dict(id='knight',    role='전열', hp=260, atk=14, cd=1000, rng=54,  ranged=None,    heal=0),
    dict(id='warrior',   role='전열', hp=210, atk=20, cd=900,  rng=54,  ranged=None,    heal=0),
    dict(id='martial',   role='딜러', hp=150, atk=30, cd=800,  rng=54,  ranged=None,    heal=0),
    dict(id='huntress',  role='원거리', hp=120, atk=22, cd=900, rng=200, ranged='spear', heal=0),
    dict(id='wizard',    role='지원', hp=110, atk=10, cd=1400, rng=200, ranged='orb',   heal=26),
    dict(id='mwarrior1', role='전열', hp=220, atk=18, cd=950,  rng=54,  ranged=None,    heal=0),
    dict(id='mwarrior2', role='전열', hp=230, atk=17, cd=950,  rng=54,  ranged=None,    heal=0),
    dict(id='mwarrior3', role='전열', hp=215, atk=19, cd=900,  rng=54,  ranged=None,    heal=0),
    dict(id='mking1',    role='전열', hp=280, atk=15, cd=1100, rng=54,  ranged=None,    heal=0),
    dict(id='mking2',    role='전열', hp=290, atk=16, cd=1100, rng=54,  ranged=None,    heal=0),
    dict(id='hknight2',  role='전열', hp=250, atk=16, cd=1000, rng=54,  ranged=None,    heal=0),
    dict(id='martial2',  role='딜러', hp=145, atk=32, cd=800,  rng=54,  ranged=None,    heal=0),
    dict(id='martial3',  role='딜러', hp=140, atk=34, cd=780,  rng=54,  ranged=None,    heal=0),
    dict(id='huntress2', role='원거리', hp=115, atk=24, cd=880, rng=200, ranged='spear', heal=0),
    dict(id='ewizard1',  role='원거리', hp=105, atk=26, cd=1100, rng=200, ranged='orb', heal=0),
    dict(id='ewizard2',  role='원거리', hp=100, atk=28, cd=1080, rng=200, ranged='orb', heal=0),
]

ENEMIES = dict(
    goblin   =dict(hp=45,   atk=8,  cd=800,  spd=40, rng=34, flying=0, boss=0),
    mushroom =dict(hp=110,  atk=12, cd=1400, spd=20, rng=34, flying=0, boss=0),
    skeleton =dict(hp=75,   atk=10, cd=1100, spd=24, rng=40, flying=0, boss=0),
    eye      =dict(hp=40,   atk=7,  cd=900,  spd=34, rng=34, flying=1, boss=0),
    worm     =dict(hp=900,  atk=26, cd=1500, spd=14, rng=46, flying=0, boss=1),
    wizardBoss=dict(hp=1200, atk=34, cd=1500, spd=18, rng=60, flying=0, boss=1),
    rat      =dict(hp=35,   atk=6,  cd=700,  spd=52, rng=30, flying=0, boss=0),
    slime    =dict(hp=130,  atk=10, cd=1600, spd=16, rng=30, flying=0, boss=0),
    bat      =dict(hp=38,   atk=7,  cd=800,  spd=44, rng=30, flying=1, boss=0),
    mimic    =dict(hp=420,  atk=22, cd=1200, spd=10, rng=40, flying=0, boss=0),
    bogWorm  =dict(hp=1400, atk=40, cd=1500, spd=14, rng=46, flying=0, boss=1),
    frostWorm=dict(hp=1700, atk=46, cd=1500, spd=14, rng=46, flying=0, boss=1),
    abyssWizard=dict(hp=2100, atk=54, cd=1450, spd=18, rng=60, flying=0, boss=1),
    doomWorm =dict(hp=2800, atk=62, cd=1450, spd=15, rng=46, flying=0, boss=1),
    infernoWorm=dict(hp=3700, atk=72, cd=1400, spd=15, rng=46, flying=0, boss=1),
    lastWizard=dict(hp=4900, atk=85, cd=1400, spd=20, rng=60, flying=0, boss=1),
)

REGIONS = [
    dict(pool=['goblin','mushroom','eye'],     elite='mushroom', boss='worm'),
    dict(pool=['skeleton','goblin','eye'],     elite='skeleton', boss='wizardBoss'),
    dict(pool=['rat','slime','mushroom'],      elite='slime',    boss='bogWorm'),
    dict(pool=['bat','rat','skeleton'],        elite='skeleton', boss='frostWorm'),
    dict(pool=['eye','bat','skeleton'],        elite='eye',      boss='abyssWizard'),
    dict(pool=['skeleton','slime','goblin'],   elite='mimic',    boss='doomWorm'),
    dict(pool=['goblin','bat','slime'],        elite='slime',    boss='infernoWorm'),
    dict(pool=['skeleton','bat','rat'],        elite='mimic',    boss='lastWizard'),
]

GROWTH = 0.2; BOSS_ADD = 0.4; ELITE_MULT = 1.08; ATKFAC = 0.75

def build_stage(rid, index):
    kind = '보스' if index == 6 else ('정예' if index == 5 else '일반')
    glob = (rid - 1) * 7 + index
    mult = 1 + glob * GROWTH + (BOSS_ADD if kind == '보스' else 0)
    spawns = []
    n = 6 + int(index * 1.5) + (rid - 1) * 2
    t = 1200
    pool = REGIONS[rid - 1]['pool']
    for i in range(n):
        spawns.append(dict(at=t, id=pool[(i + index) % 3]))
        t += 1500 - min(700, index * 80 + (rid - 1) * 120)
    if kind == '정예':
        spawns.append(dict(at=t + 800, id=REGIONS[rid - 1]['elite']))
        spawns.append(dict(at=t + 1600, id=REGIONS[rid - 1]['elite']))
    if kind == '보스':
        spawns.append(dict(at=t + 1500, id=REGIONS[rid - 1]['boss']))
    if kind == '정예':
        mult *= ELITE_MULT
    return dict(spawns=sorted(spawns, key=lambda s: s['at']), mult=mult, kind=kind)

def unit_mult(r, lv, enh):
    return RARITY_MULT[r] * (1 + 0.6 * (lv - 1)) * (1 + 0.08 * enh)

def syn_bonus(c):
    return 0.25 if c >= 3 else (0.1 if c >= 2 else 0)

class F:
    __slots__ = ('team','x','y','hp','maxHp','atk','cd','range','speed','px','state','t','fired','cdLeft','target','ranged','heal','flying','boss','dead')

def build_battle(units, stage):
    cnt = {}
    for u in units:
        r = ALLIES[u[0]]['role']; cnt[r] = cnt.get(r, 0) + 1
    fighters = []
    for (ai, r, lv, enh, cell) in units[:6]:
        d = ALLIES[ai]
        m = unit_mult(r, lv, enh) * (1 + syn_bonus(cnt.get(d['role'], 0)))
        f = F(); f.team='a'; f.x=CELL_X[cell % 3]; f.y=CELL_Y[cell // 3]
        f.hp=f.maxHp=round(d['hp']*m); f.atk=d['atk']*m; f.cd=d['cd']; f.range=d['rng']
        f.speed=0; f.px=48; f.state='idle'; f.t=random.random()*600; f.fired=False
        f.cdLeft=300+random.random()*400; f.target=None; f.ranged=d['ranged']
        f.heal=(d['heal']*m) or None; f.flying=0; f.boss=0; f.dead=False
        fighters.append(f)
    return dict(f=fighters, projs=[], time=0, spawned=0, stage=stage, result=None)

def spawn(b, eid):
    d = ENEMIES[eid]; m = b['stage']['mult']
    lane = random.randrange(3)
    f = F(); f.team='e'; f.x=W+30; f.y=CELL_Y[lane]-(26 if d['flying'] else 0)
    f.hp=f.maxHp=round(d['hp']*m); f.atk=d['atk']*(1+(m-1)*ATKFAC); f.cd=d['cd']
    f.range=d['rng']; f.speed=d['spd']; f.px=48; f.state='move'; f.t=0; f.fired=False
    f.cdLeft=400; f.target=None; f.ranged=None; f.heal=None; f.flying=d['flying']
    f.boss=d['boss']; f.dead=False
    b['f'].append(f)

def damage(b, f, dmg):
    if f.dead: return
    f.hp -= dmg
    if f.hp <= 0:
        f.dead=True; f.state='die'; f.t=0
    elif f.state != 'atk':
        f.state='hit'; f.t=0

def step(b, dt):
    if b['result']:
        b['time'] += dt
        for f in b['f']: f.t += dt
        return
    b['time'] += dt
    sp = b['stage']['spawns']
    while b['spawned'] < len(sp) and sp[b['spawned']]['at'] <= b['time']:
        spawn(b, sp[b['spawned']]['id']); b['spawned'] += 1
    allies = [f for f in b['f'] if f.team=='a' and not f.dead]
    enemies = [f for f in b['f'] if f.team=='e' and not f.dead]
    for f in b['f']:
        f.t += dt
        if f.dead: continue
        foes = enemies if f.team=='a' else allies
        tgt=None; bd=1e9
        for o in foes:
            dd = abs(o.x-f.x)+abs(o.y-f.y)*0.5
            if dd < bd: bd=dd; tgt=o
        f.target = tgt
        if f.state=='hit':
            if f.t > HIT_MS: f.state='idle'; f.t=0
            continue
        if f.state=='atk':
            if not f.fired and f.t > ATK_MS*0.55:
                f.fired=True
                if f.heal:
                    hurt = sorted([a for a in allies if a.hp < a.maxHp], key=lambda a: a.hp/a.maxHp)
                    if hurt and hurt[0].hp/hurt[0].maxHp < 0.85:
                        b['projs'].append(dict(x=f.x,y=f.y-29,target=hurt[0],dmg=f.heal,heal=True))
                    elif f.target:
                        b['projs'].append(dict(x=f.x,y=f.y-29,target=f.target,dmg=f.atk,heal=False))
                elif f.target:
                    if f.ranged:
                        b['projs'].append(dict(x=f.x,y=f.y-29,target=f.target,dmg=f.atk,heal=False))
                    else:
                        damage(b, f.target, f.atk)
            if f.t > ATK_MS:
                f.state='idle'; f.t=0; f.cdLeft = f.cd - ATK_MS
            continue
        f.cdLeft -= dt
        can_heal = f.heal and any(a.hp/a.maxHp < 0.85 for a in allies)
        if f.team=='a':
            if (tgt and abs(tgt.x-f.x) <= f.range+6) or can_heal:
                if f.cdLeft <= 0: f.state='atk'; f.t=0; f.fired=False
                elif f.state != 'idle': f.state='idle'
        else:
            if tgt and abs(tgt.x-f.x) <= f.range:
                if f.cdLeft <= 0: f.state='atk'; f.t=0; f.fired=False
                else: f.state='idle'
            else:
                f.state='move'; f.x -= f.speed*dt/1000
    for p in b['projs']:
        t = p['target']
        tx, ty = t.x, t.y - t.px*0.5
        dx, dy = tx-p['x'], ty-p['y']
        d = math.hypot(dx,dy) or 1
        v = 340*dt/1000
        if d <= v+4 or t.dead:
            p['done']=True
            if not t.dead:
                if p['heal']: t.hp = min(t.maxHp, t.hp + p['dmg'])
                else: damage(b, t, p['dmg'])
        else:
            p['x'] += dx/d*v; p['y'] += dy/d*v
    b['projs'] = [p for p in b['projs'] if not p.get('done')]
    aliveE = any(f.team=='e' and not f.dead for f in b['f'])
    aliveA = any(f.team=='a' and not f.dead for f in b['f'])
    if not aliveA: b['result']='lose'
    elif b['spawned'] >= len(sp) and not aliveE: b['result']='win'
    for f in b['f']:
        if f.team=='e' and not f.dead and f.x < 20: f.x = 20

def run_battle(units, stage, dt=50, cap_ms=600_000):
    b = build_battle(units, stage)
    while not b['result'] and b['time'] < cap_ms:
        step(b, dt)
    return b['result'] or 'timeout', b['time']

# profiles: (allyIdx, rarity, lv, enh, cell)  front col = 2,5,8
def squad(name):
    if name == 'fresh3':
        return [(0,0,1,0,2),(3,0,1,0,1),(4,0,1,0,0)]
    if name == 'early6':
        return [(0,0,1,0,2),(5,0,1,0,5),(8,0,1,0,8),(3,0,1,0,1),(13,0,1,0,4),(4,0,1,0,0)]
    if name == 'mid':
        return [(0,1,2,2,2),(5,1,2,2,5),(8,1,2,2,8),(3,1,2,2,1),(13,1,2,2,4),(4,1,2,2,0)]
    if name == 'maxed':
        return [(0,2,3,5,2),(5,2,3,5,5),(8,2,3,5,8),(3,2,3,5,1),(13,2,3,5,4),(4,2,3,5,0)]
    raise ValueError(name)

def main():
    global GROWTH, BOSS_ADD, ELITE_MULT, ATKFAC
    if len(sys.argv) > 1: GROWTH = float(sys.argv[1])
    if len(sys.argv) > 2: BOSS_ADD = float(sys.argv[2])
    if len(sys.argv) > 3: ELITE_MULT = float(sys.argv[3])
    if len(sys.argv) > 4: ATKFAC = float(sys.argv[4])
    N = int(sys.argv[5]) if len(sys.argv) > 5 else 60
    r0, r1 = (int(sys.argv[6]), int(sys.argv[7])) if len(sys.argv) > 7 else (1, 9)
    random.seed(42)
    profiles = ['fresh3','early6','mid','maxed']
    print(f"GROWTH={GROWTH} BOSS_ADD={BOSS_ADD} ELITE={ELITE_MULT} ATKFAC={ATKFAC} N={N}")
    print(f"{'stage':7} " + " ".join(f"{p:>7}" for p in profiles))
    for rid in range(r0, r1):
        for si in range(7):
            st = build_stage(rid, si)
            row = []
            for p in profiles:
                w = sum(1 for _ in range(N) if run_battle(squad(p), st)[0] == 'win')
                row.append(w / N)
            print(f"{rid}-{si+1:<4} " + " ".join(f"{x*100:6.0f}%" for x in row))

if __name__ == '__main__':
    main()
