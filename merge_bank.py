"""Merge per-chapter question JSON files into app/data/questions.js, with validation."""
import json
import glob
import re
import sys
import collections

BANK = r"C:\Users\mbeck\src\learn\citizenship-prep\bank"
OUT = r"C:\Users\mbeck\src\learn\citizenship-prep\docs\data\questions.js"

all_q = []
errors = []
for path in sorted(glob.glob(BANK + r"\*.json")):
    with open(path, encoding="utf-8") as f:
        items = json.load(f)
    for it in items:
        ctx = f"{path}:{it.get('id','?')}"
        for field in ("id", "chapter", "type", "q", "opts", "a", "expl", "diff"):
            if field not in it:
                errors.append(f"{ctx} missing {field}")
        if it.get("type") not in ("mc", "tf"):
            errors.append(f"{ctx} bad type")
        opts = it.get("opts", [])
        if it.get("type") == "mc" and len(opts) != 4:
            errors.append(f"{ctx} mc needs 4 opts, has {len(opts)}")
        if it.get("type") == "tf" and opts != ["True", "False"]:
            errors.append(f"{ctx} tf opts must be [True,False]")
        a = it.get("a", -1)
        if not isinstance(a, int) or not (0 <= a < len(opts)):
            errors.append(f"{ctx} answer index out of range")
        if it.get("chapter") not in range(1, 11):
            errors.append(f"{ctx} bad chapter {it.get('chapter')}")
        if len(set(opts)) != len(opts):
            errors.append(f"{ctx} duplicate options")
        if not it.get("expl", "").strip():
            errors.append(f"{ctx} empty explanation")
    all_q.extend(items)

ids = [q["id"] for q in all_q]
dupes = [i for i, n in collections.Counter(ids).items() if n > 1]
if dupes:
    errors.append(f"duplicate ids: {dupes}")

# near-duplicate question text check (normalized)
norm = collections.Counter(re.sub(r"\W+", "", q["q"].lower()) for q in all_q)
near = [t for t, n in norm.items() if n > 1]
if near:
    print(f"WARNING: {len(near)} near-duplicate question texts (not fatal)")
    seen = {}
    for q in all_q:
        k = re.sub(r"\W+", "", q["q"].lower())
        if norm[k] > 1:
            seen.setdefault(k, []).append(q["id"])
    for k, v in seen.items():
        print("  dup:", v)

if errors:
    print("ERRORS:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

by_ch = collections.Counter(q["chapter"] for q in all_q)
by_type = collections.Counter(q["type"] for q in all_q)
by_pos = collections.Counter(q["a"] for q in all_q if q["type"] == "mc")
print(f"total {len(all_q)}")
print("by chapter:", dict(sorted(by_ch.items())))
print("by type:", dict(by_type))
print("mc answer positions:", dict(sorted(by_pos.items())))

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generated from bank/*.json — questions grounded in Discover Canada (IRCC).\n")
    f.write("const QUESTIONS = ")
    json.dump(all_q, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", OUT)

