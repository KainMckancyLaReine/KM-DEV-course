#!/usr/bin/env python3
"""
KM.dev — AI Developer Course
build.py

1. Composes work.html and faq.html from the index.html shell so that the
   navigation, menu, loader, follower and footer can only ever exist once.
2. Emits course.html with the same shell (its <main> is authored by hand).
3. Emits a single-file bundle (dist/km-dev-ai-course.html) with every page
   inlined, for hosting where only one file can be published.
"""

import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
DIST = os.path.join(ROOT, 'dist')

def read(p):
    return io.open(p, encoding='utf-8').read()

def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('  →', os.path.relpath(p, ROOT), '%.1f KB' % (len(s.encode('utf-8')) / 1024))

MAIN_RE = re.compile(r'(<main class="page-main"[^>]*>)(.*?)(</main>)', re.S)

def shell_of(html):
    m = MAIN_RE.search(html)
    return html[:m.start()], html[m.end():]

def compose(template, page, title, desc, main_html):
    head, tail = shell_of(template)
    head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, head, flags=re.S)
    head = re.sub(r'(<meta name="description" content=")[^"]*(">)',
                  lambda m: m.group(1) + desc + m.group(2), head)
    # active navigation state
    head = head.replace(' class="nav__link is-active"', ' class="nav__link"')
    head = head.replace('class="nav__link" href="%s"' % page,
                        'class="nav__link is-active" href="%s"' % page)
    return (head
            + '<main class="page-main" id="main" data-page="%s">\n' % page
            + main_html
            + '\n</main>\n' + tail)

def main():
    index = read(os.path.join(ROOT, 'index.html'))
    print('build · pages')

    pages = [
        ('work.html', 'Work — KM.dev AI Developer Course',
         'Six project tracks. Build one real site, not a template.',
         read(os.path.join(BUILD, 'work.main.html'))),
        ('faq.html', 'FAQ — KM.dev AI Developer Course',
         'What you need, what you don’t, and what happens after you finish.',
         read(os.path.join(BUILD, 'faq.main.html'))),
    ]
    for page, title, desc, body in pages:
        write(os.path.join(ROOT, page), compose(index, page, title, desc, body))

    # ---------------------------------------------------------------- bundle
    print('build · single-file bundle')
    css = '\n'.join(read(os.path.join(ROOT, 'assets/css', f))
                    for f in ['01-foundation.css', '02-chrome.css', '03-sections.css', '04-app.css'])
    js = '\n'.join(read(os.path.join(ROOT, 'assets/js', f))
                   for f in ['core.js', 'modules.js', 'km-config.js', 'km-i18n.js',
                             'seed-data.js', 'km-data.js', 'km-blocks.js',
                             'km-app.js', 'km-admin.js'])

    import re as _re
    if _re.search(r'</\s*script', js, _re.I):
        raise SystemExit('a source file contains </script>, which would end the inline block')

    bundled_pages = ['index.html', 'course.html', 'work.html', 'faq.html',
                     'login.html', 'signup.html', 'reset.html', 'admin.html',
                     'README-academy.html'] + \
                    [f for f in sorted(os.listdir(ROOT)) if f.startswith('app-') and f.endswith('.html')]

    mains = {}
    for name in bundled_pages:
        html = read(os.path.join(ROOT, name))
        m = MAIN_RE.search(html)
        t = re.search(r'<title>(.*?)</title>', html, re.S).group(1)
        space = re.search(r'<main class="page-main"[^>]*data-space="([^"]*)"', html)
        mains[name.replace('.html', '')] = {
            'html': m.group(2), 'title': t, 'page': name,
            'space': space.group(1) if space else 'site'}

    head, tail = shell_of(index)
    # strip the document scaffolding — the artifact host supplies it
    head = re.sub(r'<!DOCTYPE html>\s*<html[^>]*>\s*', '', head, flags=re.I)
    head = re.sub(r'<meta charset[^>]*>\s*', '', head, flags=re.I)
    head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head, flags=re.I)
    head = re.sub(r'</head>\s*<body>\s*', '', head, flags=re.I)
    head = re.sub(r'<link rel="stylesheet" href="assets/css/[^"]*">\s*', '', head)
    tail = re.sub(r'<script src="assets/js/[^"]*"></script>\s*', '', tail)
    tail = re.sub(r'</body>\s*</html>\s*$', '', tail, flags=re.I)
    head = head.replace('<head>', '')

    import json
    # keep <title>/<meta>/<link> at the very top (the host scans the first 8KB
    # for a title) and put the stylesheet immediately after them, before markup
    split_at = head.index('<a class="skip"')
    meta, body_head = head[:split_at], head[split_at:]
    meta = meta.replace('<title>KM.dev — AI Developer Course</title>',
                        '<title>KM.dev AI Course</title>')
    head = meta + '<style>\n' + css + '\n</style>\n' + body_head
    bundle = (head
              + '<main class="page-main" id="main" data-page="index.html" data-space="site">\n'
              + mains['index']['html'] + '\n</main>\n'
              + tail
              + '<script>window.KM_PAGES = ' + json.dumps(mains) + ';</script>\n'
              + '<script>\n' + js + '\n</script>\n')
    write(os.path.join(DIST, 'km-dev-ai-course.html'), bundle)

if __name__ == '__main__':
    main()
