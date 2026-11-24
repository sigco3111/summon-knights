#!/usr/bin/env python3
"""Repack raw sprite strips into uniform-canvas strips + META for sheets.ts."""
import os
import numpy as np
from PIL import Image

UNZ = '/downloads/assets/unz'
OUT = '/downloads/slotbound/src/spr'

CHARS = {
 'mw1': ('1751690_Medieval Warrior Pack/Medieval Warrior Pack',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Hit.png','die':'Death.png'}),
 'mw2': ('Medieval Warrior Pack 2/Sprites',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Take Hit.png','die':'Death.png'}),
 'mw3': ('Medieval Warrior Pack 3/Sprites',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Get Hit.png','die':'Death.png'}),
 'mk1': ('Medieval King Pack/Medieval King Pack',
         {'idle':'Idle.png','atk':'Attack_1.png','hit':'Hit.png','die':'Death.png'}),
 'mk2': ('Medieval King Pack 2/Sprites',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Take Hit.png','die':'Death.png'}),
 'hk2': ('Hero Knight 2/Sprites',
         {'idle':'Idle.png','atk':'Attack.png','hit':'Take Hit.png','die':'Death.png'}),
 'mh2': ('Martial Hero 2/Sprites',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Take hit.png','die':'Death.png'}),
 'mh3': ('Martial Hero 3/Sprite',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Take Hit.png','die':'Death.png'}),
 'hu2': ('Huntress 2/Sprites/Character',
         {'idle':'Idle.png','atk':'Attack.png','hit':'Get Hit.png','die':'Death.png'}),
 'ew2': ('EVil Wizard 2/Sprites',
         {'idle':'Idle.png','atk':'Attack1.png','hit':'Take hit.png','die':'Death.png'}),
 'ew3': ('10377238_Evil Wizard 3/Evil Wizard 3/Sprites',
         {'idle':'Idle.png','atk':'Attack.png','hit':'Get hit.png','die':'Death.png','move':'Run.png'}),
 'rat': ('17365709_Monsters Creatures Fantasy 2/Monsters Creatures Fantasy 2/Rat',
         {'idle':'idle.png','atk':'attack_bite.png','hit':'hurt.png','die':'rat-death.png','move':'run.png'}),
 'slime': ('17365709_Monsters Creatures Fantasy 2/Monsters Creatures Fantasy 2/Slime',
         {'idle':'idle.png','atk':'attack.png','hit':'hurt.png','die':'death.png','move':'walk.png'}),
 'bat': ('17365709_Monsters Creatures Fantasy 2/Monsters Creatures Fantasy 2/Bat',
         {'idle':'fly.png','atk':'attack.png','hit':'hurt.png','die':'death.png','move':'fly.png'}),
 'mimic': ('17365709_Monsters Creatures Fantasy 2/Monsters Creatures Fantasy 2/Mimic',
         {'idle':'idle_open.png','atk':'attack_1.png','hit':'hurt.png','die':'death.png','move':'idle_open.png'}),
}

def find_file(dirfrag, fname):
    base = os.path.join(UNZ, dirfrag)
    p = os.path.join(base, fname)
    if os.path.exists(p): return p
    for root, _, files in os.walk(UNZ):
        if dirfrag in root and fname in files: return os.path.join(root, fname)
    raise FileNotFoundError(f'{dirfrag}/{fname}')

def split_frames(img):
    w, h = img.size
    if w % h == 0:
        n = w // h
        return [img.crop((i*h, 0, (i+1)*h, h)) for i in range(n)], n, 'square'
    a = np.asarray(img.convert('RGBA'))[:, :, 3].astype(np.float64)
    prof = a.sum(axis=0)
    v = prof.var() + 1e-9
    best = []
    for T in range(24, w//2 + 1):
        if w % T: continue
        d = ((prof - np.roll(prof, T))**2).mean() / v
        best.append((d, T))
    best.sort()
    if not best: raise ValueError(f'no divisor for {w}x{h}')
    d, T = best[0]
    n = w // T
    print(f'    probe {w}x{h}: chose T={T} n={n} score={d:.3f} (top3={[(round(x,3),t) for x,t in best[:3]]})')
    return [img.crop((i*T, 0, (i+1)*T, h)) for i in range(n)], n, f'probe{T}'

def bbox(img):
    a = np.asarray(img.convert('RGBA'))[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    if len(xs) == 0: return (0, 0, img.size[0], img.size[1])
    return (xs.min(), ys.min(), xs.max()+1, ys.max()+1)

meta = {}
for prefix, (dirfrag, anims) in CHARS.items():
    print(f'== {prefix}')
    crops = {}
    for anim, fname in anims.items():
        if anim == 'move' and fname == anims.get('idle'):
            continue
        path = find_file(dirfrag, fname)
        frames, n, how = split_frames(Image.open(path).convert('RGBA'))
        b = None
        for f in frames:
            fb = bbox(f)
            b = fb if b is None else (min(b[0],fb[0]), min(b[1],fb[1]), max(b[2],fb[2]), max(b[3],fb[3]))
        crops[anim] = [f.crop(b) for f in frames]
        print(f'  {anim}: {os.path.basename(path)} n={n} [{how}] union={b[2]-b[0]}x{b[3]-b[1]}')
    W = max(c.size[0] for fr in crops.values() for c in fr)
    H = max(c.size[1] for fr in crops.values() for c in fr)
    idle_h = crops['idle'][0].size[1]
    for anim, fr in crops.items():
        strip = Image.new('RGBA', (W*len(fr), H), (0,0,0,0))
        for i, c in enumerate(fr):
            strip.paste(c, (i*W + (W-c.size[0])//2, H - c.size[1]), c)
        strip.save(os.path.join(OUT, f'{prefix}_{anim}.png'))
    meta[prefix] = {'fw': W, 'fh': H, 'cx': W//2, 'fy': H, 'h': idle_h}
    print(f'  canvas {W}x{H} h={idle_h}')

print('\nMETA snippet:')
for k, v in meta.items():
    print('  %s: { fw: %d, fh: %d, cx: %d, fy: %d, h: %d },' % (k, v['fw'], v['fh'], v['cx'], v['fy'], v['h']))
