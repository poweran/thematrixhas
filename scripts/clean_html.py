#!/usr/bin/env python3
"""
clean_html.py

Extract a minimal, mobile-friendly HTML document from a scraped forum/blog HTML file.

Usage:
  python3 scripts/clean_html.py input.html -o output.html

The script tries to use readability-lxml to extract the main article. If unavailable,
it falls back to a heuristic that picks the largest text-containing element.

It rewrites relative asset URLs (images/scripts/styles) to point at the sibling "_files"
directory next to the source HTML when possible so embedded images still work.

Requirements (see requirements.txt): beautifulsoup4, lxml, readability-lxml, chardet
"""

from __future__ import annotations

import argparse
import os
import sys
import io
from urllib.parse import unquote, urlparse
import re

try:
    from bs4 import BeautifulSoup, Comment
except Exception:
    print("Missing dependency: beautifulsoup4. Please install with: pip install -r requirements.txt")
    raise


def detect_encoding(b: bytes) -> str:
    # Try utf-8 first, then windows-1251, then fallback to latin-1
    for enc in ("utf-8", "windows-1251", "latin-1"):
        try:
            b.decode(enc)
            return enc
        except Exception:
            continue
    return "utf-8"


def read_html(path: str) -> tuple[str, str]:
    b = open(path, "rb").read()
    enc = detect_encoding(b)
    try:
        return b.decode(enc, errors="replace"), enc
    except Exception:
        return b.decode("utf-8", errors="replace"), "utf-8"

def make_soup(html_text: str) -> BeautifulSoup:
    """Create a BeautifulSoup object trying common parsers in order."""
    for parser in ("lxml", "html5lib", "html.parser"):
        try:
            return BeautifulSoup(html_text, parser)
        except Exception:
            continue
    # last resort
    return BeautifulSoup(html_text, "html.parser")

def remove_unwanted(soup: BeautifulSoup) -> None:
    # remove scripts, styles, comments, noscript, meta, link[rel!=stylesheet?]
    for tag in soup(["script", "style", "noscript", "iframe", "input", "button", "form", "svg", "video", "audio"]):
        tag.decompose()

    for tag in soup.find_all(text=lambda t: isinstance(t, Comment)):
        try:
            tag.extract()
        except Exception:
            pass


def pick_main_content(soup: BeautifulSoup) -> BeautifulSoup:
    # If the page contains forum posts, prefer extracting only the post content
    # i.e., for each div.post take .post-content (or .post-body/.post-box) and concatenate them.
    posts = soup.select('div.post')
    if posts:
        out = BeautifulSoup('', 'html.parser')
        container = out.new_tag('div')
        out.append(container)
        for p in posts:
            # try common selectors for post body/content
            content = p.select_one('.post-content') or p.select_one('.post-body') or p.select_one('.post-box')
            if content:
                # copy only the inner HTML/text of the content
                fragment = make_soup(str(content))
                # remove nested author/links if accidentally present (keep .quote-box for later processing)
                for bad in fragment.select('.post-author, .post-links, .post-links ul, .post-links li'):
                    bad.decompose()
                # append children preserving order
                for child in fragment.body.contents if fragment.body else fragment.contents:
                    container.append(child)
        title = soup.title.string if soup.title else ''
        return out, title

    # Prefer readability if available
    try:
        from readability import Document

        html = str(soup)
        doc = Document(html)
        summary = doc.summary()
        title = doc.short_title() or (soup.title.string if soup.title else "")
        return make_soup(summary), title
    except Exception:
        # Heuristic: find the largest element by text length among common containers
        candidates_selectors = [
            "article",
            "main",
            "#pun-viewtopic",
            ".post",
            ".postcontent",
            ".post-body",
            ".topic",
            "#content",
            "body",
        ]
        best = None
        best_len = 0
        for sel in candidates_selectors:
            node = soup.select_one(sel)
            if node:
                l = len(node.get_text(separator=" ", strip=True))
                if l > best_len:
                    best_len = l
                    best = node

        # If nothing found, pick the largest div
        if best is None:
            for node in soup.find_all(["div", "section"], recursive=True):
                l = len(node.get_text(separator=" ", strip=True))
                if l > best_len:
                    best_len = l
                    best = node

        title = soup.title.string if soup.title else ""
        if best is None:
            return make_soup("<div>%s</div>" % soup.get_text(separator="\n", strip=True)), title
        return best, title


def rewrite_asset_urls(content_soup: BeautifulSoup, src_html_path: str, out_path: str) -> None:
    # Map assets to sibling "<basename>_files" directory next to source HTML when possible
    src_dir = os.path.dirname(src_html_path)
    base_name = os.path.splitext(os.path.basename(src_html_path))[0]
    assets_dir = os.path.join(src_dir, base_name + "_files")

    def fix_url(url: str) -> str:
        if not url:
            return url
        url = url.strip()
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https") or url.startswith("//"):
            return url
        # decode percent-encodings
        decoded = unquote(url)
        # get basename
        name = os.path.basename(decoded)
        if not name:
            return url
        # if assets_dir exists and contains this file, generate relative path from out_path
        if os.path.isdir(assets_dir) and os.path.exists(os.path.join(assets_dir, name)):
            rel = os.path.relpath(os.path.join(assets_dir, name), os.path.dirname(out_path))
            return rel.replace("\\", "/")
        # otherwise, try to find file anywhere in the source dir
        cand = None
        for root, _, files in os.walk(src_dir):
            if name in files:
                cand = os.path.join(root, name)
                break
        if cand:
            return os.path.relpath(cand, os.path.dirname(out_path)).replace("\\", "/")
        # fallback: return decoded (might be an absolute path fragment)
        return decoded

    for tag in content_soup.find_all(True):
        for attr in ("src", "href"):
            if tag.has_attr(attr):
                try:
                    tag[attr] = fix_url(tag[attr])
                except Exception:
                    pass


TEMPLATE_CSS = r"""
        /* Minimal mobile-friendly CSS similar to the example file */
        * { margin:0; box-sizing:border-box }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height:1.6; color:#2c3e50; background:#f8f9fa; padding:12px; font-size:15px }
    .container { max-width:680px; margin:0 auto; background:white; border-radius:8px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.1) }
        h1 { font-size:22px; margin-bottom:16px; color:#1a202c; text-align:center }
        h2 { font-size:19px; margin:24px 0 12px; color:#2d3748; border-left:4px solid #4a90e2; padding-left:10px }
        h3 { font-size:17px; margin:16px 0 8px; color:#4a5568 }
        p { margin-bottom:12px; text-align:justify }
        .highlight { background:#e8f4f8; padding:12px; border-radius:6px; margin:12px 0 }
        .warning { background:#fff3cd; padding:12px; border-radius:6px; margin:12px 0 }
    .step-number { display:inline-block; background:#4a90e2; color:white; width:26px; height:26px; border-radius:50%; text-align:center; line-height:26px; margin-right:8px; font-weight:700; font-size:14px }
        details { margin:12px 0; background:#f7fafc; border-radius:6px; padding:10px }
        summary { cursor:pointer; font-weight:600; color:#2d3748 }
        .figure { text-align:center; margin:14px 0 18px }
    .figure img { max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.08); display:inline-block }
    .figure figcaption { font-size:13px; color:#6b7c86; margin-top:8px }
    details[open] summary { margin-bottom:10px }
    .tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0 }
    .tag { background:#e8f4f8; color:#2c5282; padding:4px 10px; border-radius:12px; font-size:12px }
    blockquote.extracted-quote { background:#f1f8ff; border-left:4px solid #8fbce6; padding:10px 12px; margin:12px 0; border-radius:6px }
    blockquote.extracted-quote p { margin:0 }
"""


def build_output_html(title: str, content_html: str) -> str:
    doc = f"""
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
  <style>{TEMPLATE_CSS}</style>
</head>
<body>
  <div class="container">
    <h1>{title}</h1>
    {content_html}
  </div>
</body>
</html>
"""
    return doc


def main(argv=None):
    p = argparse.ArgumentParser(description="Create a minimal mobile-friendly HTML from scraped forum/blog HTML files")
    p.add_argument("inputs", nargs='+', help="one or more source HTML files (e.g. sources/Файл.html sources/Файл2.html)")
    p.add_argument("-o", "--output", help="output HTML file", default="relaxation_guide.html")
    p.add_argument("--title", help="optional output title (overrides input titles)")
    args = p.parse_args(argv)


    # Verify inputs exist
    # global seen quotes across all inputs to dedupe repeated quoted blocks
    seen_quotes = set()
    for inp in args.inputs:
        if not os.path.exists(inp):
            print(f"Input not found: {inp}")
            sys.exit(2)

    # Aggregate content from all inputs
    aggregate = BeautifulSoup('', 'html.parser')
    agg_container = aggregate.new_tag('div')
    aggregate.append(agg_container)
    title = None
    for inp in args.inputs:
        html_text, enc = read_html(inp)
        soup = make_soup(html_text)
        remove_unwanted(soup)

        content_node, t = pick_main_content(soup)
        if title is None:
            title = t

        # Ensure we have a soup fragment
        if not isinstance(content_node, BeautifulSoup):
            content_soup = make_soup(str(content_node))
        else:
            content_soup = content_node

        remove_unwanted(content_soup)

        # Rewrite asset urls relative to this input file
        rewrite_asset_urls(content_soup, inp, args.output)

        # Process quote-boxes: dedupe across files and normalize to <blockquote class='extracted-quote'>
        for q in content_soup.select('.quote-box'):
            qtext = ' '.join(q.get_text(separator=' ', strip=True).split())
            if not qtext:
                q.decompose()
                continue
            if qtext in seen_quotes:
                q.decompose()
            else:
                seen_quotes.add(qtext)
                newb = content_soup.new_tag('blockquote')
                newb['class'] = 'extracted-quote'
                newp = content_soup.new_tag('p')
                newp.string = qtext
                newb.append(newp)
                q.replace_with(newb)

        # Append children of this fragment to aggregate container (preserve order)
        children = content_soup.body.contents if getattr(content_soup, 'body', None) else content_soup.contents
        for child in children:
            try:
                agg_container.append(child)
            except Exception:
                agg_container.append(BeautifulSoup(str(child), 'html.parser'))

    # Some small cleanups: remove event handlers and most attributes on the aggregate container
    for tag in aggregate.find_all(True):
        # remove event handlers and inline styles, keep class for certain allowed classes
        for k in list(tag.attrs.keys()):
            if k.startswith("on") or k in ("style", "id", "role", "aria-*"):
                try:
                    del tag.attrs[k]
                except Exception:
                    pass
        # keep classes only for step-number and extracted-quote
        if tag.has_attr('class'):
            classes = [c for c in tag.get('class', []) if c in ('step-number','extracted-quote')]
            if classes:
                tag['class'] = classes
            else:
                del tag.attrs['class']

    # Now aggressively sanitize: keep only structural textual elements and their textual content.
    def sanitize_fragment(fragment: BeautifulSoup) -> BeautifulSoup:
        from bs4 import NavigableString, Tag

        allowed_tags = set(['h1','h2','h3','h4','h5','p','ul','ol','li','blockquote','figure','figcaption','details','summary'])

        out_soup = BeautifulSoup('', 'html.parser')
        container = out_soup.new_tag('div')
        out_soup.append(container)

        def append_paragraph(parent, text):
            text = text.strip()
            if not text:
                return
            parts = [s.strip() for s in re.split(r"\n\s*\n", text) if s.strip()]
            for part in parts:
                p = out_soup.new_tag('p')
                p.string = part
                parent.append(p)

        def process_node(node, parent_out):
            # NavigableString -> append to a paragraph in parent_out
            if isinstance(node, NavigableString):
                append_paragraph(parent_out, str(node))
                return

            if not isinstance(node, Tag):
                return

            name = node.name.lower()
            if name in ('p',):
                # preserve the paragraph as-is (text-only)
                append_paragraph(parent_out, node.get_text(separator='\n', strip=True))
                return

            if name in ('blockquote',) or 'quote' in ' '.join(node.get('class', [])) or 'extracted-quote' in (node.get('class') or []):
                bq = out_soup.new_tag('blockquote')
                bq['class'] = 'extracted-quote'
                # preserve paragraphs inside blockquote
                for ch in node.contents:
                    if isinstance(ch, NavigableString):
                        append_paragraph(bq, str(ch))
                    elif isinstance(ch, Tag) and ch.name.lower() == 'p':
                        append_paragraph(bq, ch.get_text(separator='\n', strip=True))
                    else:
                        append_paragraph(bq, ch.get_text(separator='\n', strip=True))
                parent_out.append(bq)
                return

            if name in ('h1','h2','h3','h4','h5'):
                newh = out_soup.new_tag(name)
                newh.string = node.get_text(separator=' ', strip=True)
                parent_out.append(newh)
                return

            if name in ('ul','ol'):
                newlist = out_soup.new_tag(name)
                for li in node.find_all('li', recursive=False):
                    newli = out_soup.new_tag('li')
                    newli.string = li.get_text(separator=' ', strip=True)
                    newlist.append(newli)
                parent_out.append(newlist)
                return

            if name == 'figure':
                newfig = out_soup.new_tag('figure')
                img = node.find('img')
                if img and img.has_attr('src'):
                    newimg = out_soup.new_tag('img')
                    newimg['src'] = img['src']
                    newfig.append(newimg)
                figcap = node.find('figcaption')
                if figcap:
                    newcap = out_soup.new_tag('figcaption')
                    newcap.string = figcap.get_text(separator=' ', strip=True)
                    newfig.append(newcap)
                parent_out.append(newfig)
                return

            # For other tags: recurse into children and preserve paragraphs inside
            for ch in node.contents:
                process_node(ch, parent_out)

        # Start from fragment root — if it's wrapper div, iterate its children
        root = fragment
        if len(fragment.contents) == 1 and isinstance(fragment.contents[0], Tag) and fragment.contents[0].name == 'div':
            root = fragment.contents[0]


        # Helper: heading heuristic for span text
        def is_heading_text(t: str) -> bool:
            if not t:
                return False
            t = t.strip()
            if len(t) > 140:
                return False
            if 'Ступень' in t or t.startswith('Зачем') or t.startswith('Метод') or t.startswith('Обязательный'):
                return True
            if t.isupper() and len(t) > 4:
                return True
            if re.match(r'^\s*\d+\.?\s*$', t):
                return True
            return False

        # Group content into sections when h2 or explicit headings encountered
        current_section = out_soup.new_tag('div')
        current_section['class'] = 'section'
        container.append(current_section)

        children = list(root.contents)
        i = 0
        def is_short_heading_text_candidate(t: str) -> bool:
            if not t:
                return False
            t = t.strip()
            if len(t) < 4 or len(t) > 140:
                return False
            # prefer strings without sentence-ending punctuation and not long multi-sentence
            if t.count('.') > 1 or t.count('?') or t.count('!'):
                # allow one punctuation but avoid multi-sentence lines
                if t.count('.') > 1:
                    return False
            # few words (heuristic): headings are usually compact
            if len(t.split()) > 12:
                return False
            return True

        while i < len(children):
            ch = children[i]
            # If current node contains a span.step-number (explicit), synthesize H2
            if isinstance(ch, Tag):
                # look for explicit step-number span (only treat explicit step-number spans as headings)
                heading_span = None
                for s in ch.find_all('span'):
                    if any('step-number' in c for c in (s.get('class') or [])):
                        heading_span = s
                        break
                if heading_span is not None:
                    # assemble heading text: span text + following small inline text from ch
                    span_text = heading_span.get_text(separator=' ', strip=True)
                    # remaining text in node excluding the span's text
                    node_text = ch.get_text(separator=' ', strip=True)
                    rest = node_text.replace(span_text, '', 1).strip()
                    h2txt = span_text + ((' ' + rest) if rest else '')
                    current_section = out_soup.new_tag('div')
                    current_section['class'] = 'section'
                    container.append(current_section)
                    newh = out_soup.new_tag('h2')
                    # preserve the span as inner element
                    newspan = out_soup.new_tag('span')
                    newspan['class'] = ['step-number'] if 'step-number' in (heading_span.get('class') or []) else None
                    newspan.string = span_text
                    newh.append(newspan)
                    if rest:
                        newh.append(out_soup.new_string(' ' + rest))
                    current_section.append(newh)
                    i += 1
                    continue

                # Heuristic A: short standalone text in its own container (div/p with only inline children)
                txt_only = ch.get_text(separator=' ', strip=True)
                if is_short_heading_text_candidate(txt_only):
                    # ensure node is essentially a short title: has no block children like ul/ol/figure
                    block_children = any(c.name.lower() in ('ul','ol','figure','table','pre','blockquote') for c in ch.find_all(True, recursive=False))
                    if not block_children:
                        current_section = out_soup.new_tag('div')
                        current_section['class'] = 'section'
                        container.append(current_section)
                        newh = out_soup.new_tag('h2')
                        newh.string = txt_only
                        current_section.append(newh)
                        i += 1
                        continue

                # Heuristic B: <strong> or <b> followed by <br> or short sibling -> synthesize heading
                strong = ch.find(['strong','b'], recursive=False)
                attached = False
                if strong and strong.get_text(strip=True):
                    # prefer inline <br> inside same node or a following short text sibling
                    br_inside = any(c.name == 'br' for c in ch.find_all(True, recursive=False))
                    nxt = children[i+1] if i+1 < len(children) else None
                    nxt_txt = None
                    if br_inside:
                        # gather remaining text in ch after strong
                        full = ch.get_text(separator=' ', strip=True)
                        rest = full.replace(strong.get_text(separator=' ', strip=True), '', 1).strip()
                        nxt_txt = rest
                    elif nxt is not None:
                        if isinstance(nxt, NavigableString):
                            nxt_txt = str(nxt).strip()
                        elif isinstance(nxt, Tag) and nxt.name.lower() in ('p','div','span'):
                            nxt_txt = nxt.get_text(separator=' ', strip=True)
                    if nxt_txt and is_short_heading_text_candidate(nxt_txt):
                        h2txt = strong.get_text(separator=' ', strip=True)
                        if nxt_txt:
                            h2txt = h2txt + ' ' + nxt_txt
                        current_section = out_soup.new_tag('div')
                        current_section['class'] = 'section'
                        container.append(current_section)
                        newh = out_soup.new_tag('h2')
                        # preserve strong as inline element
                        newstrong = out_soup.new_tag(strong.name)
                        newstrong.string = strong.get_text(separator=' ', strip=True)
                        newh.append(newstrong)
                        if nxt_txt:
                            newh.append(out_soup.new_string(' ' + nxt_txt))
                        current_section.append(newh)
                        # if we consumed next sibling text node, skip it
                        if isinstance(nxt, (NavigableString, Tag)) and nxt_txt:
                            i += 2
                        else:
                            i += 1
                        continue

                # Heuristic C: short ALL CAPS line
                if txt_only and txt_only.isupper() and is_short_heading_text_candidate(txt_only):
                    current_section = out_soup.new_tag('div')
                    current_section['class'] = 'section'
                    container.append(current_section)
                    newh = out_soup.new_tag('h2')
                    newh.string = txt_only
                    current_section.append(newh)
                    i += 1
                    continue
            # explicit h2 -> new section
            if isinstance(ch, Tag) and ch.name.lower() == 'h2':
                current_section = out_soup.new_tag('div')
                current_section['class'] = 'section'
                container.append(current_section)
                newh = out_soup.new_tag('h2')
                newh.string = ch.get_text(separator=' ', strip=True)
                current_section.append(newh)
                i += 1
                continue

            # span.step-number or short heading-span: synthesize an H2 combining this span and the next text/sibling
            if isinstance(ch, Tag) and ch.name.lower() in ('span',) and ('step-number' in (ch.get('class') or []) or is_heading_text(ch.get_text(separator=' ', strip=True))):
                # collect heading pieces
                parts = [ch.get_text(separator=' ', strip=True)]
                # look ahead for a short text node or tag to attach (skip if it's another span.step-number)
                nxt = children[i+1] if i+1 < len(children) else None
                attached = False
                if nxt is not None:
                    if isinstance(nxt, NavigableString):
                        txt = str(nxt).strip()
                        if txt and len(txt) < 200:
                            parts.append(txt)
                            attached = True
                    elif isinstance(nxt, Tag) and nxt.name.lower() in ('strong','b','span'):
                        t2 = nxt.get_text(separator=' ', strip=True)
                        if t2 and len(t2) < 200:
                            parts.append(t2)
                            attached = True

                h2txt = ' '.join([p for p in parts if p])
                current_section = out_soup.new_tag('div')
                current_section['class'] = 'section'
                container.append(current_section)
                newh = out_soup.new_tag('h2')
                # preserve step-number as inner span if present
                if 'step-number' in (ch.get('class') or []):
                    sp = out_soup.new_tag('span')
                    sp['class'] = ['step-number']
                    sp.string = ch.get_text(separator=' ', strip=True)
                    newh.append(sp)
                    # append remaining text
                    rest = h2txt[len(sp.string):].strip()
                    if rest:
                        newh.append(out_soup.new_string(' ' + rest))
                else:
                    newh.string = h2txt
                current_section.append(newh)
                # if we consumed next sibling, skip it
                i += 2 if attached else 1
                continue

            # Otherwise process node into current section
            process_node(ch, current_section)
            i += 1

        return out_soup

    # Sanitize the aggregated content
    content_soup = sanitize_fragment(aggregate)

    # Build output
    out_title = args.title or title or os.path.splitext(os.path.basename(args.inputs[0]))[0]
    out_html = build_output_html(out_title, str(content_soup))

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(out_html)

    print(f"Wrote {args.output} (extracted main content from {len(args.inputs)} input files)")


if __name__ == "__main__":
    main()
