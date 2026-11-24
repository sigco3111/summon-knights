import hk_idle from './spr/hk_idle.png';
import hk_atk from './spr/hk_atk.png';
import hk_hit from './spr/hk_hit.png';
import hk_die from './spr/hk_die.png';
import fw_idle from './spr/fw_idle.png';
import fw_atk from './spr/fw_atk.png';
import fw_hit from './spr/fw_hit.png';
import fw_die from './spr/fw_die.png';
import mh_idle from './spr/mh_idle.png';
import mh_atk from './spr/mh_atk.png';
import mh_hit from './spr/mh_hit.png';
import mh_die from './spr/mh_die.png';
import hu_idle from './spr/hu_idle.png';
import hu_atk from './spr/hu_atk.png';
import hu_hit from './spr/hu_hit.png';
import hu_die from './spr/hu_die.png';
import wz_idle from './spr/wz_idle.png';
import wz_atk from './spr/wz_atk.png';
import wz_hit from './spr/wz_hit.png';
import wz_die from './spr/wz_die.png';
import sk_idle from './spr/sk_idle.png';
import sk_atk from './spr/sk_atk.png';
import sk_hit from './spr/sk_hit.png';
import sk_die from './spr/sk_die.png';
import sk_move from './spr/sk_move.png';
import go_idle from './spr/go_idle.png';
import go_atk from './spr/go_atk.png';
import go_hit from './spr/go_hit.png';
import go_die from './spr/go_die.png';
import go_move from './spr/go_move.png';
import mu_idle from './spr/mu_idle.png';
import mu_atk from './spr/mu_atk.png';
import mu_hit from './spr/mu_hit.png';
import mu_die from './spr/mu_die.png';
import mu_move from './spr/mu_move.png';
import fe_idle from './spr/fe_idle.png';
import fe_atk from './spr/fe_atk.png';
import fe_hit from './spr/fe_hit.png';
import fe_die from './spr/fe_die.png';
import fe_move from './spr/fe_move.png';
import ew_idle from './spr/ew_idle.png';
import ew_atk from './spr/ew_atk.png';
import ew_hit from './spr/ew_hit.png';
import ew_die from './spr/ew_die.png';
import ew_move from './spr/ew_move.png';
import fwm_idle from './spr/fwm_idle.png';
import fwm_atk from './spr/fwm_atk.png';
import fwm_hit from './spr/fwm_hit.png';
import fwm_die from './spr/fwm_die.png';
import fwm_move from './spr/fwm_move.png';

export const SHEETS: Record<string, Record<string, string>> = {
  hk: { idle: hk_idle, atk: hk_atk, hit: hk_hit, die: hk_die },
  fw: { idle: fw_idle, atk: fw_atk, hit: fw_hit, die: fw_die },
  mh: { idle: mh_idle, atk: mh_atk, hit: mh_hit, die: mh_die },
  hu: { idle: hu_idle, atk: hu_atk, hit: hu_hit, die: hu_die },
  wz: { idle: wz_idle, atk: wz_atk, hit: wz_hit, die: wz_die },
  sk: { idle: sk_idle, atk: sk_atk, hit: sk_hit, die: sk_die, move: sk_move },
  go: { idle: go_idle, atk: go_atk, hit: go_hit, die: go_die, move: go_move },
  mu: { idle: mu_idle, atk: mu_atk, hit: mu_hit, die: mu_die, move: mu_move },
  fe: { idle: fe_idle, atk: fe_atk, hit: fe_hit, die: fe_die, move: fe_move },
  ew: { idle: ew_idle, atk: ew_atk, hit: ew_hit, die: ew_die, move: ew_move },
  fwm: { idle: fwm_idle, atk: fwm_atk, hit: fwm_hit, die: fwm_die, move: fwm_move },
};

export const META: Record<string, { fw: number; fh: number; cx: number; fy: number; h: number }> = {
  hk: { fw: 180, fh: 180, cx: 96, fy: 114, h: 51 },
  fw: { fw: 162, fh: 162, cx: 85, fy: 101, h: 45 },
  mh: { fw: 200, fh: 200, cx: 94, fy: 122, h: 52 },
  hu: { fw: 150, fh: 150, cx: 77, fy: 97, h: 42 },
  wz: { fw: 231, fh: 190, cx: 110, fy: 141, h: 86 },
  sk: { fw: 150, fh: 150, cx: 82, fy: 101, h: 51 },
  go: { fw: 150, fh: 150, cx: 74, fy: 101, h: 36 },
  mu: { fw: 150, fh: 150, cx: 75, fy: 101, h: 37 },
  fe: { fw: 150, fh: 150, cx: 77, fy: 92, h: 31 },
  ew: { fw: 150, fh: 150, cx: 73, fy: 100, h: 55 },
  fwm: { fw: 90, fh: 90, cx: 42, fy: 58, h: 41 },
};
