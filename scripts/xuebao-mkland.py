import json, sys
d = json.load(open(sys.argv[1])); out = []
for f in d['features']:
    g = f['geometry']; polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    for poly in polys:
        r = poly[0]
        if len(r) < 5: continue
        # 经纬度 → 0..360 / 0..180 的整数（0.5 度精度），逗号分隔，环之间用 ;
        out.append(",".join(f"{round((lon + 180) * 2)},{round((90 - lat) * 2)}" for lon, lat in r))
s = ";".join(out)
open(sys.argv[2], "w").write("// 地球仪表面的陆地轮廓（Natural Earth 110m，公有领域）：x=(经度+180)*2, y=(90-纬度)*2\nexport const LAND = \"" + s + "\";\n")
print(len(s))
