"""Print the structure of a GLB (meshes, materials, textures, skins, animations). python glbinfo.py file.glb"""
import json, struct, sys

p = sys.argv[1]
with open(p, "rb") as f:
    magic, ver, total = struct.unpack("<4sII", f.read(12))
    ln, typ = struct.unpack("<I4s", f.read(8))
    j = json.loads(f.read(ln))
print("file bytes", total, "generator", j.get("asset"))
print("extensionsUsed", j.get("extensionsUsed"))
acc = j.get("accessors", [])
for i, m in enumerate(j.get("meshes", [])):
    for pr in m["primitives"]:
        a = pr["attributes"]
        print("mesh", i, m.get("name"), "verts", acc[a["POSITION"]]["count"], "tris", acc[pr["indices"]]["count"] // 3 if "indices" in pr else "?",
              "attrs", sorted(a), "mat", pr.get("material"), "min", acc[a["POSITION"]].get("min"), "max", acc[a["POSITION"]].get("max"))
for i, m in enumerate(j.get("materials", [])):
    print("material", i, json.dumps(m)[:400])
for i, im in enumerate(j.get("images", [])):
    bv = j["bufferViews"][im["bufferView"]] if "bufferView" in im else {}
    print("image", i, im.get("mimeType"), im.get("name"), bv.get("byteLength"))
for i, s in enumerate(j.get("skins", [])):
    print("skin", i, "joints", len(s["joints"]), [j["nodes"][n].get("name") for n in s["joints"]][:80])
for i, a in enumerate(j.get("animations", [])):
    tmax = max(acc[s["input"]]["max"][0] for s in a["samplers"])
    n = max(acc[s["input"]]["count"] for s in a["samplers"])
    print("animation", i, a.get("name"), "channels", len(a["channels"]), "duration %.3f" % tmax, "keys", n)
print("nodes", len(j.get("nodes", [])), "scenes", j.get("scenes"))
for i, n in enumerate(j.get("nodes", [])[:6]):
    print(" node", i, {k: v for k, v in n.items() if k != "children"})
