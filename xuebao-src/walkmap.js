/* 雪宝能走的地方：一张 8cm 一格的地面网格。
 * 大厅、门洞、花园先“铺”成可走，再把家具、树、喷泉、池塘“挖”掉（障碍已按雪宝半个身宽放大）。
 * 点地板走过去用 A* 找路再拉直；键盘／摇杆走路时碰到障碍就顺着边滑。
 */
export function createWalkMap({ x0, x1, z0, z1, cell = 0.08 }) {
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  const g = new Uint8Array(nx * nz);
  const ci = (x) => Math.floor((x - x0) / cell), cj = (z) => Math.floor((z - z0) / cell);
  const cx = (i) => x0 + (i + 0.5) * cell, cz = (j) => z0 + (j + 0.5) * cell;
  const inb = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz;
  function paint(test, v, bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1) {
    const i0 = Math.max(0, ci(bx0)), i1 = Math.min(nx - 1, ci(bx1)), j0 = Math.max(0, cj(bz0)), j1 = Math.min(nz - 1, cj(bz1));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (test(cx(i), cz(j))) g[j * nx + i] = v;
  }
  const api = {
    cell,
    rect(ax0, ax1, az0, az1, v = 1) { paint((x, z) => x >= ax0 && x <= ax1 && z >= az0 && z <= az1, v, ax0, ax1, az0, az1); return api; },
    circle(x, z, r, v = 0) { paint((px, pz) => (px - x) ** 2 + (pz - z) ** 2 <= r * r, v, x - r, x + r, z - r, z + r); return api; },
    ellipse(x, z, rx, rz, v = 1, rot = 0) {
      const c = Math.cos(rot), s = Math.sin(rot), m = Math.max(rx, rz);
      paint((px, pz) => { const dx = px - x, dz = pz - z, u = dx * c + dz * s, w = -dx * s + dz * c; return (u / rx) ** 2 + (w / rz) ** 2 <= 1; }, v, x - m, x + m, z - m, z + m); return api;
    },
    // 沿折线铺一条宽 w 的路
    stroke(pts, w, v = 1) {
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        paint((px, pz) => { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2 <= w * w; }, v, Math.min(ax, bx) - w, Math.max(ax, bx) + w, Math.min(az, bz) - w, Math.max(az, bz) + w);
      }
      return api;
    },
    walkable(x, z) { const i = ci(x), j = cj(z); return inb(i, j) && g[j * nx + i] === 1; },
    // 最近的能走的点（一圈一圈往外找）
    clamp(x, z) {
      if (api.walkable(x, z)) return { x, z };
      const i0 = ci(x), j0 = cj(z);
      for (let r = 1; r < 80; r++) {
        let best = null, bd = 1e9;
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di, j = j0 + dj; if (!inb(i, j) || g[j * nx + i] !== 1) continue;
          const d = (cx(i) - x) ** 2 + (cz(j) - z) ** 2; if (d < bd) { bd = d; best = { x: cx(i), z: cz(j) }; }
        }
        if (best) return best;
      }
      return { x, z };
    },
    // 两点之间是否一路都能走（每半格取一个样）
    los(ax, az, bx, bz) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (cell * 0.5)));
      for (let k = 0; k <= n; k++) { const t = k / n; if (!api.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
      return true;
    },
    // A*（8 邻接）＋ 拉直；返回 [{x,z}…]，不含起点
    path(ax, az, bx, bz) {
      const b = api.clamp(bx, bz);
      if (api.los(ax, az, b.x, b.z)) return [b];
      const a = api.walkable(ax, az) ? { x: ax, z: az } : api.clamp(ax, az);
      const s = cj(a.z) * nx + ci(a.x), t = cj(b.z) * nx + ci(b.x);
      const N = nx * nz, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const ti = t % nx, tj = (t / nx) | 0, h = (k) => { const di = Math.abs((k % nx) - ti), dj = Math.abs(((k / nx) | 0) - tj); return (di + dj + (Math.SQRT2 - 2) * Math.min(di, dj)); };
      const heap = []; const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
      gs[s] = 0; push(s, h(s));
      const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
      let found = false;
      while (heap.length) {
        const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t) { found = true; break; }
        const i = k % nx, j = (k / nx) | 0;
        for (const [di, dj, c] of NB) {
          const ii = i + di, jj = j + dj; if (!inb(ii, jj)) continue; const kk = jj * nx + ii; if (g[kk] !== 1 || closed[kk]) continue;
          if (di && dj && (g[j * nx + ii] !== 1 || g[jj * nx + i] !== 1)) continue; // 不斜着擦过墙角
          const ng = gs[k] + c; if (ng < gs[kk]) { gs[kk] = ng; from[kk] = k; push(kk, ng + h(kk)); }
        }
      }
      if (!found) return [b];
      const raw = []; for (let k = t; k !== -1 && k !== s; k = from[k]) raw.push({ x: cx(k % nx), z: cz((k / nx) | 0) });
      raw.reverse(); raw[raw.length - 1] = b;
      // 拉直：能直接看到的点就跳过中间的
      const out = []; let cur = a, k = 0;
      while (k < raw.length) { let far = k; for (let m = raw.length - 1; m > k; m--) if (api.los(cur.x, cur.z, raw[m].x, raw[m].z)) { far = m; break; } out.push(raw[far]); cur = raw[far]; k = far + 1; }
      return out;
    },
    // 自由走（键盘／摇杆）：先整步，不行就只走 x 或只走 z
    slide(x, z, dx, dz) {
      if (api.walkable(x + dx, z + dz)) return { x: x + dx, z: z + dz };
      if (api.walkable(x + dx, z)) return { x: x + dx, z };
      if (api.walkable(x, z + dz)) return { x, z: z + dz };
      return { x, z };
    }
  };
  return api;
}
