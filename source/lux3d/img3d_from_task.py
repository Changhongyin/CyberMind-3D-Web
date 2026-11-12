"""Image-to-3D (G1) from the output image of an earlier Lux3D image task. Resumable.
  python img3d_from_task.py <label> <image_taskid> [faceCount]"""
import json, os, sys
import lux3d

label, src = sys.argv[1], sys.argv[2]
faces = int(sys.argv[3]) if len(sys.argv) > 3 else 60000
out = os.path.join(lux3d.ROOT, "assets", "lux3d", label)
os.makedirs(out, exist_ok=True)
sp = os.path.join(out, "chain_state.json")
st = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
if "img3d" not in st:
    url = [o["content"] for o in lux3d.get(src)["d"]["outputs"] if o and o.get("content", "").startswith("http")][0]
    res = lux3d.create("img3d", {"img": url, "version": "G1", "faceCount": faces, "outputFormat": ["zip", "glb"]}, label + "_img3d")
    if res.get("c") != "0":
        sys.exit(json.dumps(res, ensure_ascii=False))
    st["img3d"] = res["d"]
    json.dump(st, open(sp, "w", encoding="utf-8"), indent=1)
    print("task", st["img3d"], flush=True)
r = lux3d.wait(st["img3d"], 2400)
if r["d"]["status"] == 3 and "files" not in st:
    st["files"] = lux3d.fetch(st["img3d"], out, label + "_img3d")
    json.dump(st, open(sp, "w", encoding="utf-8"), indent=1)
print("DONE", json.dumps(st))
