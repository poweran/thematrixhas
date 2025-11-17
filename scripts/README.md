clean_html.py
=================

Purpose
-------
Extract a minimal, mobile-friendly HTML document from a scraped forum/blog HTML file. It keeps the main textual content, images (rewritten to use the local _files folder when available), and basic formatting (headings, paragraphs, lists, details).

Usage
-----
Install dependencies into your Python environment:

    pip install -r scripts/requirements.txt

Run the script:

    python3 scripts/clean_html.py sources/"ГЛУБОКАЯ РЕЛАКСАЦИЯ ТЕЛА И УМА 2.html" -o relaxation_guide.html

Notes
-----
- The script prefers the readability-lxml extractor when available. If it's not installed, it uses a heuristic to find the largest content container.
- Asset URLs are rewritten to point at the <basename>_files folder next to the input HTML when files exist there.
