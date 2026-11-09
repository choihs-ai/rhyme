#!/usr/bin/env python3
"""가이드·안내 페이지 생성기.

본문은 tools/guide-src/*.html (첫 줄 = 메타 JSON) 에 있고,
이 스크립트가 공통 머리·꼬리를 붙여 guide/*.html, about.html, privacy.html 을 만든다.
    python3 tools/build-guide.py
"""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "guide-src"
SITE = "https://choihs-ai.github.io/rhyme/"

THEME = ("<script>try{var t=localStorage.getItem('rhyme.theme')||'dark';"
         "if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';"
         "document.documentElement.dataset.theme=t;}catch(e){}</script>")


def page(meta, body, depth):
    up = "../" * depth
    title = meta["title"]
    full_title = f"{title} | 라임 스캐너" if meta.get("suffix", True) else title
    canon = SITE + meta["path"]
    nav_cur = meta.get("nav", "")
    def nav(key, href, label):
        cur = ' aria-current="page"' if key == nav_cur else ""
        return f'<a href="{up}{href}"{cur}>{label}</a>'
    crumb = ""
    if meta.get("crumb"):
        crumb = f'<div class="crumb"><a href="{up}guide/">작사 가이드</a></div>\n'
    ld = ""
    if meta.get("article"):
        ld_obj = {
            "@context": "https://schema.org", "@type": "Article",
            "headline": title, "description": meta["desc"], "inLanguage": "ko",
            "datePublished": meta.get("date", "2026-11-09"),
            "author": {"@type": "Organization", "name": "라임 스캐너"},
            "mainEntityOfPage": canon,
        }
        ld = f'<script type="application/ld+json">{json.dumps(ld_obj, ensure_ascii=False)}</script>\n'
    return f"""<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(full_title)}</title>
<meta name="description" content="{html.escape(meta['desc'])}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="{'article' if meta.get('article') else 'website'}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(meta['desc'])}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}icons/icon-512.png">
<meta property="og:locale" content="ko_KR">
<meta name="theme-color" content="#141413">
<meta name="color-scheme" content="dark light">
<link rel="icon" type="image/png" sizes="32x32" href="{up}icons/favicon-32.png">
<link rel="apple-touch-icon" href="{up}icons/apple-touch-icon.png">
<link rel="stylesheet" href="{up}css/guide.css">
{THEME}
{ld}</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{up}index.html"><img src="{up}icons/icon-192.png" alt="" width="26" height="26">라임 스캐너</a>
  <nav aria-label="사이트">{nav('app', 'index.html', '분석기')}{nav('guide', 'guide/', '작사 가이드')}{nav('about', 'about.html', '소개')}</nav>
</div></header>
<main><div class="wrap">
{crumb}{body.strip()}
</div></main>
<footer class="foot"><div class="wrap">
  <span>© 2026 라임 스캐너</span>
  <a href="{up}about.html">소개</a>
  <a href="{up}privacy.html">개인정보처리방침</a>
  <a href="https://github.com/choihs-ai/rhyme/issues">문의</a>
</div></footer>
</body>
</html>
"""


def main():
    pages = []
    for f in sorted(SRC.glob("*.html")):
        first, body = f.read_text(encoding="utf-8").split("\n", 1)
        meta = json.loads(first)
        depth = meta["path"].count("/")
        out = ROOT / (meta["path"] + ("index.html" if meta["path"].endswith("/") else ""))
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page(meta, body, depth), encoding="utf-8")
        pages.append(meta)
        print("작성:", out.relative_to(ROOT))
    # 사이트맵 (분석기 첫 화면 포함)
    urls = [SITE] + [SITE + m["path"] for m in pages]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{u}</loc></url>" for u in urls]
    sm.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    print("작성: sitemap.xml", len(urls), "개 주소")


if __name__ == "__main__":
    main()
