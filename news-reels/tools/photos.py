"""Find and download free-license photos from Wikimedia Commons.

  python3 tools/photos.py search "Xi Jinping 2024"          # list candidates + licenses
  python3 tools/photos.py get "File:Name.jpg" out/dir/xi.jpg  # download (1600px) + write credit
Only CC0 / public-domain / CC BY / CC BY-SA files are shown; credits go to <file>.credit.txt
"""
import json, re, sys, urllib.parse, urllib.request, html

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "news-reels/1.0 (automated video builder)"}
OK = re.compile(r"^(cc0|pd|public domain|cc by(-sa)? ?\d|cc-by)", re.I)

def fetch(url):
    import time, urllib.error
    for i in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == 5: raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * 2 ** i
            print(f"(rate limited, waiting {wait}s)", file=sys.stderr); time.sleep(min(wait, 60))

def api(**p):
    p.update(format="json", formatversion=2)
    return json.loads(fetch(API + "?" + urllib.parse.urlencode(p)))

def strip(s): return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()

def info(titles, width=1600):
    r = api(action="query", prop="imageinfo", titles="|".join(titles), iiprop="url|extmetadata|size", iiurlwidth=width)
    out = []
    for pg in r["query"]["pages"]:
        if "imageinfo" not in pg: continue
        ii = pg["imageinfo"][0]; m = ii.get("extmetadata", {})
        lic = strip(m.get("LicenseShortName", {}).get("value"))
        out.append(dict(title=pg["title"], url=ii["url"], w=ii["width"], h=ii["height"],
                        license=lic, artist=strip(m.get("Artist", {}).get("value"))[:80],
                        date=strip(m.get("DateTimeOriginal", {}).get("value"))[:20], ok=bool(OK.match(lic))))
    return out

if sys.argv[1] == "search":
    r = api(action="query", list="search", srsearch=sys.argv[2] + " filetype:bitmap", srnamespace=6, srlimit=int(sys.argv[3]) if len(sys.argv) > 3 else 12)
    titles = [x["title"] for x in r["query"]["search"]]
    for x in info(titles) if titles else []:
        if x["ok"]: print(f'{x["title"]} | {x["w"]}x{x["h"]} | {x["license"]} | {x["artist"]} | {x["date"]}')
elif sys.argv[1] == "get":
    x = info([sys.argv[2]])[0]
    assert x["ok"], f"license not reusable: {x['license']}"
    data = fetch(x["url"])            # original file; resize locally
    from PIL import Image; import io
    im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((2400, 2400))
    im.save(sys.argv[3], quality=90)
    credit = f'{x["artist"] or "Unknown"} / {x["license"]} / Wikimedia Commons'
    open(sys.argv[3] + ".credit.txt", "w").write(credit + "\n" + "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(x["title"].replace(" ", "_")) + "\n")
    print("saved", sys.argv[3], "|", credit)
