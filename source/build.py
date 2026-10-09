"""Rebuild ../index.html from template.html + app.js + data/*.json.

The page is a single self-contained file: the figure data (extracted from the paper's vector figures) and the
Optimistic font files are inlined, so the site makes no external requests.

    python3 source/build.py
"""
import base64, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
load = lambda f: json.load(open(os.path.join(HERE, "data", f)))

def rnd(o, n):
    if isinstance(o, float): return round(o, n)
    if isinstance(o, list): return [rnd(v, n) for v in o]
    if isinstance(o, dict): return {k: rnd(v, n) for k, v in o.items()}
    return o

data = {
    "fig3": rnd(load("fig3.json"), 2),
    "research": rnd(load("research.json"), 4),
    "activity": rnd(load("activity.json"), 3),
    "graphs": load("graphs.json"),
    # Figure 7 of the paper: share of the contribution graph in the selected solution's ancestry (git-parent, total)
    "ancestry": {
        "pb": [["B100", 25.3, 90.0], ["B200", 25.7, 92.6], ["B300", 24.3, 89.9], ["B500", 22.6, 81.6]],
        "imo": [["B20", 19.4, 21.3], ["B40", 26.4, 30.1], ["B80", 25.1, 29.8], ["B120", 27.0, 33.0], ["B160", 24.8, 31.5]],
    },
}

# Optimistic, the typeface of the paper's title. Set OPTIMISTIC_DIR if the .ttf files live elsewhere; without
# them the page falls back to a locally installed Optimistic, then Helvetica.
font_dir = os.environ.get("OPTIMISTIC_DIR", "/Library/Fonts")
faces = []
for weight, name in [(400, "Regular"), (500, "Medium"), (600, "SemiBold"), (700, "Bold")]:
    p = os.path.join(font_dir, "OptimisticV5_%s.ttf" % name)
    src = "local('Optimistic %s')" % name
    if os.path.exists(p):
        src = "url(data:font/ttf;base64,%s) format('truetype'), " % base64.b64encode(open(p, "rb").read()).decode() + src
    faces.append("@font-face { font-family: 'Optimistic'; font-weight: %d; font-style: normal; font-display: swap; src: %s; }" % (weight, src))

tpl = open(os.path.join(HERE, "template.html")).read()
js = open(os.path.join(HERE, "app.js")).read()
out = (tpl.replace("/*__FONTS__*/", "\n".join(faces))
          .replace("/*__DATA__*/", "window.GS = " + json.dumps(data, separators=(",", ":")) + ";")
          .replace("/*__APP__*/", js))
dst = os.path.join(os.path.dirname(HERE), "index.html")
open(dst, "w").write(out)
print("wrote", dst, len(out) // 1024, "KB")
