"""Split the full handbook catalog into a light list index plus one detail file per hero.

Paths are rewritten relative to the figure asset base (models/, media/, audio/, thumbs/),
portraits and skill icons point at the WebP versions, and build-only provenance is dropped.
Usage: python3 split-catalog.py <catalog.json> <out-dir>
"""
import json, os, sys

src, out = sys.argv[1], sys.argv[2]
catalog = json.load(open(src, encoding="utf-8"))


def strip(path):
    return path[len("assets/"):] if isinstance(path, str) and path.startswith("assets/") else path


def webp(path):
    path = strip(path)
    return os.path.splitext(path)[0] + ".webp" if isinstance(path, str) and path else path


def thumb(path):
    p = webp(path)
    return "thumbs/" + p if p else p


index = {"version": catalog.get("version"), "asOf": catalog.get("asOf"), "defaultHeroId": catalog.get("defaultHeroId"), "heroes": []}
os.makedirs(os.path.join(out, "heroes"), exist_ok=True)
for hero in catalog["heroes"]:
    skins = []
    for skin in hero.get("skins", []):
        skin = {k: v for k, v in skin.items() if k not in ("source", "modelSha256")}
        skin["thumb"] = thumb(skin.get("portrait"))
        skin["portrait"] = webp(skin.get("portrait"))
        skin["models"] = {k: strip(v) for k, v in (skin.get("models") or {}).items()}
        skins.append(skin)
    skills = []
    for skill in hero.get("skills", []):
        skill = dict(skill)
        skill["icon"] = webp(skill.get("icon"))
        skills.append(skill)
    detail = {k: v for k, v in hero.items() if k not in ("source",)}
    detail.update(skins=skins, skills=skills, audioManifest=strip(hero.get("audioManifest")))
    with open(os.path.join(out, "heroes", f"{hero['id']}.json"), "w", encoding="utf-8") as fh:
        json.dump(detail, fh, ensure_ascii=False, separators=(",", ":"))
    index["heroes"].append({
        "id": hero["id"], "name": hero["name"], "profession": hero["profession"], "brand": hero["brand"],
        "defaultSkinId": hero.get("defaultSkinId"), "tagline": hero.get("tagline", ""),
        "audioManifest": bool(hero.get("audioManifest")),
        "skins": [{"id": s["id"], "name": s["name"], "thumb": s["thumb"]} for s in skins],
    })
with open(os.path.join(out, "index.json"), "w", encoding="utf-8") as fh:
    json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
print(len(index["heroes"]), "heroes")
