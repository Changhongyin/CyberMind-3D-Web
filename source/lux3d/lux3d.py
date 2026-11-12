"""Minimal Aholo Lux3D REST client for this project (China gateway).

Key comes from the LUX3D_CN_API_KEY environment variable; it is never printed or stored.
Every created task is appended to assets/lux3d/ledger.jsonl BEFORE polling, so an
interrupted run can resume with `get`/`wait`/`fetch` instead of paying twice.

Usage:
  python lux3d.py create <endpoint-alias> '<json body>' <label>
  python lux3d.py get <taskid>
  python lux3d.py wait <taskid> [timeout_s]
  python lux3d.py fetch <taskid> <out_dir> <label>     # download every output URL
  python lux3d.py list
"""
import json, os, sys, time, urllib.request, urllib.error, urllib.parse

BASE = "https://api.aholo3d.cn"
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
LEDGER = os.path.join(ROOT, "assets", "lux3d", "ledger.jsonl")

ALIAS = {
    "image": "/lux3d/v1/generate/multimodal-to-image/task/create",
    "fourview": "/lux3d/v1/generate/image-to-four-view/task/create",
    "img3d": "/lux3d/v1/generate/img-to-3d/task/create",
    "text3d": "/lux3d/v1/generate/text-to-3d/task/create",
    "material": "/lux3d/v1/generate/material-transfer/task/create",
    "export": "/lux3d/v1/multi-format-export/task/create",
    "partsplit": "/lux3d/v1/part-split/task/create",
    "articulate": "/lux3d/v1/articulation-animation/task/create",
    "rig": "/lux3d/v1/animations/rig/task/create",
    "retarget": "/lux3d/v1/animations/retarget/task/create",
}


def _key():
    k = os.environ.get("LUX3D_CN_API_KEY")
    if not k:
        sys.exit("LUX3D_CN_API_KEY is not set")
    return k.strip()


def _req(method, path, body=None, timeout=60):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Authorization", _key())
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"c": "HTTP%d" % e.code, "m": e.read().decode("utf-8", "replace")[:600], "d": None}


def _log(rec):
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    rec["time"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(LEDGER, "a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def create(alias, body, label):
    res = _req("POST", ALIAS[alias], body)
    _log({"event": "create", "label": label, "endpoint": alias, "request": body,
          "c": res.get("c"), "m": res.get("m"), "taskId": res.get("d")})
    return res


def get(taskid):
    return _req("GET", "/lux3d/v1/generate/task/get?taskid=%s" % taskid)


def wait(taskid, timeout=1800, every=10):
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        res = get(taskid)
        d = res.get("d") or {}
        st = d.get("status")
        if st != last:
            print("[%4ds] status=%s" % (time.time() - t0, st), flush=True)
            last = st
        if st in (3, 4, 6):
            _log({"event": "done", "taskId": taskid, "status": st, "seconds": round(time.time() - t0),
                  "outputs": [o.get("content") for o in (d.get("outputs") or [])]})
            return res
        time.sleep(every)
    print("TIMEOUT (task keeps running server-side; re-run wait)")
    return get(taskid)


def _urls(content):
    """An output 'content' is a URL, a JSON array of URLs, or a JSON object with actions."""
    if not content or content == "NOT_REQUESTED":
        return []
    c = content.strip()
    if c.startswith("http"):
        return [(None, c)]
    try:
        j = json.loads(c)
    except Exception:
        return []
    out = []
    if isinstance(j, list):
        out = [(str(i), u) for i, u in enumerate(j) if isinstance(u, str) and u.startswith("http")]
    elif isinstance(j, dict):
        for a in j.get("actions", []):
            for k, v in a.items():
                if isinstance(v, str) and v.startswith("http"):
                    out.append((a.get("animation_id"), v))
    return out


def fetch(taskid, out_dir, label):
    res = get(taskid)
    d = res.get("d") or {}
    os.makedirs(out_dir, exist_ok=True)
    saved = []
    n = 0
    for o in d.get("outputs") or []:
        for tag, url in _urls(o.get("content")):
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".bin"
            name = "%s_t%s_%d%s%s" % (label, taskid, n, ("_" + tag) if tag else "", ext)
            path = os.path.join(out_dir, name)
            n += 1
            rq = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(rq, timeout=300) as r, open(path, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            saved.append((name, os.path.getsize(path)))
            print("saved", name, os.path.getsize(path), flush=True)
    _log({"event": "fetch", "taskId": taskid, "label": label, "files": saved})
    return saved


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1]
    if cmd == "create":
        body = json.loads(sys.argv[3]) if not sys.argv[3].startswith("@") else json.load(open(sys.argv[3][1:], encoding="utf-8"))
        print(json.dumps(create(sys.argv[2], body, sys.argv[4]), ensure_ascii=False))
    elif cmd == "get":
        print(json.dumps(get(sys.argv[2]), ensure_ascii=False, indent=1))
    elif cmd == "wait":
        r = wait(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1800)
        print(json.dumps(r, ensure_ascii=False, indent=1))
    elif cmd == "fetch":
        fetch(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "list":
        print(json.dumps(_req("GET", "/lux3d/v1/generate/task/list?page=1&pageSize=20"), ensure_ascii=False, indent=1)[:6000])
