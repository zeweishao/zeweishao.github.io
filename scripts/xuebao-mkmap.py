import json, math, re, sys
SRC, PLACES, OUT = sys.argv[1:4]
d = json.load(open(SRC))
R = math.radians
lon0, lat0, p1, p2 = 105.0, 35.0, 25.0, 47.0
n = (math.sin(R(p1)) + math.sin(R(p2))) / 2
C = math.cos(R(p1))**2 + 2*n*math.sin(R(p1))
rho0 = math.sqrt(C - 2*n*math.sin(R(lat0))) / n
def alb(lon, lat):
    th = n * R(lon - lon0); rho = math.sqrt(C - 2*n*math.sin(R(lat))) / n
    return rho*math.sin(th), rho0 - rho*math.cos(th)
def rings(f):
    g = f['geometry']; polys = g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for ring in poly: yield ring
# main extent: everything except rings fully south of 17.5N, and except JD
main = []
for f in d['features']:
    if f['properties'].get('adchar') == 'JD': continue
    for r in rings(f):
        if max(p[1] for p in r) < 17.5: continue
        main.append(r)
xs, ys = [], []
for r in main:
    for lon, lat in r: x, y = alb(lon, lat); xs.append(x); ys.append(y)
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
W = 1000; pad = 14; s = (W - 2*pad) / (maxx - minx); H = round((maxy - miny) * s + 2*pad)
def P(lon, lat): x, y = alb(lon, lat); return ((x - minx)*s + pad, (maxy - y)*s + pad)
def dp(pts, tol):
    if len(pts) < 3: return pts
    keep = [False]*len(pts); keep[0] = keep[-1] = True; st = [(0, len(pts)-1)]
    while st:
        a, b = st.pop(); ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx-ax, by-ay; L = math.hypot(dx, dy) or 1e-9
        best, bi = -1, -1
        for i in range(a+1, b):
            px, py = pts[i]; dd = abs(dy*px - dx*py + bx*ay - by*ax) / L if L > 1e-8 else math.hypot(px-ax, py-ay)
            if dd > best: best, bi = dd, i
        if best > tol: keep[bi] = True; st += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]
def area(pts): return abs(sum(pts[i][0]*pts[i-1][1] - pts[i-1][0]*pts[i][1] for i in range(len(pts)))) / 2
def path(rs, proj, tol, minA, close=True):
    out = []
    for r in rs:
        pts = dp([proj(*p) for p in r], tol)
        if close and (len(pts) < 4 or area(pts) < minA): continue
        out.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + ("Z" if close else ""))
    return "".join(out)
provs = []
for f in d['features']:
    nm = f['properties'].get('name')
    if not nm: continue
    rs = [r for r in rings(f) if max(p[1] for p in r) >= 17.5]
    provs.append({"n": nm, "d": path(rs, P, 0.9, 2.0), "c": [round(v, 1) for v in P(*f['properties'].get('centroid', f['properties'].get('center')))]})
# 南海诸岛 inset: lon 106-123, lat 3-24.5, bottom-right box
iw = 118; lo0, lo1, la0, la1 = 106.0, 123.0, 2.8, 24.5
(ax0, ay1), (ax1, ay0) = alb(lo0, la1), alb(lo1, la0)
xs2, ys2 = [], []
for lon in (lo0, lo1):
    for lat in (la0, la1): x, y = alb(lon, lat); xs2.append(x); ys2.append(y)
ix0, ix1, iy0, iy1 = min(xs2), max(xs2), min(ys2), max(ys2)
si = iw / (ix1 - ix0); ih = round((iy1 - iy0) * si)
bx, by = W - pad - iw - 4, H - pad - ih - 4
def Pi(lon, lat): x, y = alb(lon, lat); return (bx + (x - ix0)*si, by + (iy1 - y)*si)
inset_land, inset_jd = [], ""
for f in d['features']:
    adc = f['properties'].get('adchar')
    rs = [r for r in rings(f) if any(lo0 <= p[0] <= lo1 and la0 <= p[1] <= la1 for p in r)]
    if adc == 'JD': inset_jd = path(rs, Pi, 0.3, 0, close=False) if False else path(rs, Pi, 0.3, 0.0)
    else: inset_land.append(path(rs, Pi, 0.4, 0.3))
# 地点 → 省
src = open(PLACES).read()
places = {m[0]: (float(m[1]), float(m[2])) for m in re.findall(r'"([a-z0-9-]+)": P\("[^"]+", ([\d.]+), ([\d.]+)', src)}
def inside(pt, ring):
    x, y = pt; c = False
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[i-1]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: c = not c
    return c
pmap = {}
for pid, (lat, lon) in places.items():
    for f in d['features']:
        nm = f['properties'].get('name')
        if nm and any(inside((lon, lat), r) for r in rings(f)): pmap[pid] = nm; break
    else:  # 海边、岛上的点：取最近的省界
        best = min(((min((p[0]-lon)**2 + (p[1]-lat)**2 for r in rings(f) for p in r), f['properties']['name']) for f in d['features'] if f['properties'].get('name')))
        pmap[pid] = best[1]
data = {"W": W, "H": H, "proj": {"lon0": lon0, "lat0": lat0, "p1": p1, "p2": p2, "minx": minx, "maxy": maxy, "s": s, "pad": pad},
        "prov": provs, "inset": {"x": bx, "y": by, "w": iw, "h": ih, "land": "".join(inset_land), "jd": inset_jd}, "where": pmap}
js = "/* 雪宝游记 · 足迹地图用的中国地图（省界，阿里云 DataV 数据简化），Albers 投影；生成脚本见项目记录 */\nwindow.XUEBAO_CHINA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(OUT, "w").write(js)
print("W,H", W, H, "bytes", len(js), "places", len(places), "mapped", len(pmap), [k for k in places if k not in pmap])
