"""Turn a loader page into a standalone file that works outside T3 (where file:// fetches are blocked).

  python scripts/page.py page.html out.html

Swaps the loader line for the library itself, so the result opens in any browser.
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
lib = (root / "assets" / "v.svg").read_text(encoding="utf-8").split("<![CDATA[", 1)[1].split("]]>", 1)[0]
page = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
inline = 'addEventListener("DOMContentLoaded", () => (0, eval)(%s));' % json.dumps(lib).replace("</", "<\\/")   # same timing as the async fetch: after the body exists
out, n = re.subn(r"fetch\([^\n]*v\.svg[^\n]*", lambda m: inline, page, count=1)
if not n:
    sys.exit('no loader line found: fetch(".../v.svg")...')
pathlib.Path(sys.argv[2]).write_text(out, encoding="utf-8")
print(sys.argv[2])
