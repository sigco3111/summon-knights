// 슬롯 아이콘: 직접 그린 16x16 픽셀 아이콘 (자체 제작, 외부 에셋 아님)
type Grid = string[][];
const PAL: Record<string, string> = { k: '#20160c', w: '#f4f4f0', s: '#aeb6c0', S: '#6e7886', g: '#f0c038', G: '#b98a1c', b: '#7a4a22', B: '#3b7dd8', d: '#264e96', r: '#d8453b', R: '#8f2620', p: '#a05ad0', P: '#5d2f86', c: '#7fe3f0', n: '#e8c9a0', N: '#b78e62', y: '#fff3a8', e: '#58b050', E: '#2f7a2c' };
function mk(): Grid { return Array.from({ length: 16 }, () => Array(16).fill('.')); }
function px(g: Grid, x: number, y: number, c: string) { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c; }
function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx - dy;
    for (;;) { px(g, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c); }
function outline(g: Grid) { const o = g.map((r) => r.slice()); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (g[y][x] !== '.') continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < 16 && xx >= 0 && xx < 16 && g[yy][xx] !== '.' && g[yy][xx] !== 'k') { o[y][x] = 'k'; break; } } } return o; }
function build(id: string): Grid {
    const g = mk();
    if (id === 'sword') {
        line(g, 13, 1, 5, 9, 's'); line(g, 14, 2, 6, 10, 'S'); line(g, 12, 1, 4, 9, 'w');
        line(g, 3, 7, 8, 12, 'g'); line(g, 4, 6, 9, 11, 'G');
        line(g, 5, 11, 2, 14, 'b'); line(g, 6, 12, 3, 15, 'b'); px(g, 2, 14, 'g'); px(g, 1, 15, 'g');
    } else if (id === 'shield') {
        rect(g, 3, 2, 10, 7, 'B'); for (let i = 0; i < 5; i++) rect(g, 3 + i, 9 + i, 10 - 2 * i, 1, 'B');
        rect(g, 7, 2, 2, 11, 'w'); rect(g, 3, 5, 10, 2, 'w'); rect(g, 3, 2, 10, 1, 'g'); rect(g, 3, 2, 1, 7, 'g'); rect(g, 12, 2, 1, 7, 'G');
    } else if (id === 'fist') {
        rect(g, 3, 5, 9, 7, 'n'); rect(g, 4, 3, 2, 3, 'n'); rect(g, 7, 3, 2, 3, 'n'); rect(g, 10, 3, 2, 3, 'n'); rect(g, 12, 6, 2, 4, 'n');
        rect(g, 3, 11, 9, 2, 'r'); rect(g, 3, 12, 9, 1, 'R'); rect(g, 5, 6, 1, 4, 'N'); rect(g, 8, 6, 1, 4, 'N'); rect(g, 11, 7, 1, 3, 'N');
    } else if (id === 'bow') {
        for (let y = 1; y <= 14; y++) { const x = 4 + Math.round(Math.sin(((y - 1) / 13) * Math.PI) * 6 * -1 + 6); px(g, 10 - Math.round(Math.sin(((y - 1) / 13) * Math.PI) * 5), y, 'b'); void x; }
        line(g, 10, 1, 10, 14, 'w'); line(g, 4, 8, 14, 8, 's'); px(g, 14, 8, 'w'); px(g, 13, 7, 's'); px(g, 13, 9, 's'); px(g, 4, 7, 'r'); px(g, 4, 9, 'r');
    } else if (id === 'staff') {
        line(g, 4, 14, 10, 6, 'b'); line(g, 5, 14, 11, 6, 'b');
        rect(g, 9, 1, 5, 5, 'p'); rect(g, 10, 0, 3, 7, 'p'); rect(g, 8, 2, 7, 3, 'p'); rect(g, 10, 2, 2, 2, 'c'); px(g, 9, 2, 'y'); rect(g, 9, 5, 4, 1, 'P');
    } else if (id === 'cross') {
        rect(g, 6, 2, 4, 12, 'e'); rect(g, 2, 6, 12, 4, 'e'); rect(g, 7, 3, 1, 10, 'y'); rect(g, 3, 7, 10, 1, 'y'); rect(g, 8, 8, 1, 5, 'E'); rect(g, 8, 8, 5, 1, 'E');
    } else { // gem
        rect(g, 6, 2, 4, 1, 'c'); rect(g, 4, 3, 8, 2, 'c'); rect(g, 3, 5, 10, 2, 'B'); rect(g, 4, 7, 8, 2, 'B'); rect(g, 5, 9, 6, 2, 'd'); rect(g, 6, 11, 4, 1, 'd'); rect(g, 7, 12, 2, 1, 'd');
        rect(g, 5, 3, 2, 1, 'w'); px(g, 4, 5, 'w'); px(g, 5, 6, 'w');
    }
    return outline(g);
}
const cache: Record<string, Grid> = {};
export function drawSymbol(cvs: HTMLCanvasElement, id: string) {
    const ctx = cvs.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, cvs.width, cvs.height);
    const g = cache[id] || (cache[id] = build(id)); const sc = Math.floor(Math.min(cvs.width, cvs.height) / 16);
    const ox = Math.floor((cvs.width - 16 * sc) / 2), oy = Math.floor((cvs.height - 16 * sc) / 2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = g[y][x]; if (c === '.') continue; ctx.fillStyle = PAL[c]; ctx.fillRect(ox + x * sc, oy + y * sc, sc, sc); }
}
