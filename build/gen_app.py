#!/usr/bin/env python3
"""
KM.dev Academy — page generator

The academy is a set of thin HTML shells; everything inside them is rendered
by the controllers in assets/js. Generating the shells from one template here
means the navigation, the account menu, the script order and the footer can
only ever exist in one place.
"""

import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700'
         '&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">')

CSS = '\n'.join('<link rel="stylesheet" href="assets/css/%s">' % f for f in [
    '01-foundation.css', '02-chrome.css', '03-sections.css', '04-app.css'])

APP_SCRIPTS = '\n'.join('<script src="assets/js/%s"></script>' % f for f in [
    'core.js', 'modules.js', 'km-config.js', 'seed-data.js',
    'km-data.js', 'km-blocks.js', 'km-app.js'])

AUTH_SCRIPTS = '\n'.join('<script src="assets/js/%s"></script>' % f for f in [
    'core.js', 'modules.js', 'km-config.js', 'seed-data.js', 'km-data.js', 'km-app.js'])

ADMIN_SCRIPTS = APP_SCRIPTS + '\n<script src="assets/js/km-admin.js"></script>'


def head(title, description):
    return ('<!DOCTYPE html>\n<html lang="en">\n<head>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<title>%s — KM.dev Academy</title>\n'
            '<meta name="description" content="%s">\n'
            '<meta name="theme-color" content="#f4f3ef">\n'
            '<meta name="robots" content="noindex">\n'
            '%s\n%s\n</head>\n<body>\n' % (title, description, FONTS, CSS))


NAV = '''
<a class="skip" href="#main">Skip to content</a>
<div class="pt" aria-hidden="true"></div>

<header class="nav is-stuck">
  <div class="shell nav__inner">
    <a class="brand" href="app-dashboard.html" aria-label="KM.dev Academy">
      KM.dev<i class="brand__dot"></i><span class="brand__sub">Academy</span>
    </a>
    <nav class="nav__links" aria-label="Course" data-learning-nav></nav>
    <div class="nav__right">
      <button class="nav__link" type="button" data-open-palette aria-label="Search">
        Search <kbd style="font-family:'Space Mono',monospace;font-size:10px;border:1px solid var(--line);border-radius:5px;padding:2px 5px;margin-left:6px">⌘K</kbd>
      </button>
      <div data-account style="display:flex;align-items:center;gap:10px"></div>
    </div>
  </div>
</header>
'''

FOOTER = '''
<footer class="footer on-dark">
  <div class="shell">
    <div class="footer__bottom" style="border-top:0;padding-top:0">
      <span class="mono">© 2026 KM.dev Academy</span>
      <span class="mono">Learn · Build · Understand · Iterate · Ship</span>
      <a class="mono" href="index.html">Back to km.dev</a>
    </div>
  </div>
</footer>
'''


def app_page(slug, title, view, description):
    return (head(title, description) + NAV +
            '\n<main class="page-main" id="main" data-page="%s" data-space="app">\n'
            '  <section class="app"><div class="shell">\n'
            '    <div data-view="%s"></div>\n'
            '  </div></section>\n'
            '</main>\n' % (slug, view) +
            FOOTER + '\n' + APP_SCRIPTS + '\n</body>\n</html>\n')


AUTH_ASIDE = '''
      <div class="auth__quote">
        <span class="t-tag">KM.dev Academy</span>
        <h2>%s</h2>
      </div>
      <div class="auth__steps">
        <div class="auth__step"><b>01</b><span>Think — decide what you are building</span></div>
        <div class="auth__step"><b>02</b><span>Prompt — learn to direct a model</span></div>
        <div class="auth__step"><b>03</b><span>Build — turn instructions into code</span></div>
        <div class="auth__step"><b>04</b><span>Ship — put it online under your name</span></div>
      </div>
'''


def auth_page(slug, title, kind, h1, sub, fields, submit, foot, aside):
    return (head(title, sub) +
            '<a class="skip" href="#main">Skip to content</a>\n'
            '<div class="handoff"><span class="handoff__line"></span>'
            '<span class="handoff__line"></span>'
            '<span class="handoff__track"><i></i></span></div>\n'
            '<div style="display:none" data-account></div>\n'
            '<main class="page-main" id="main" data-page="%s" data-space="app">\n'
            '<div class="auth">\n'
            '  <div class="auth__form">\n'
            '    <div class="auth__back"><a class="xlink" href="index.html">'
            '<i class="btn__arrow" style="transform:rotate(180deg)"></i><span>km.dev</span></a></div>\n'
            '    <div data-view="auth">\n'
            '      <span class="t-tag">%s</span>\n'
            '      <h1 style="margin-top:16px">%s</h1>\n'
            '      <p class="auth__sub">%s</p>\n'
            '      <form class="form" data-auth="%s" novalidate>\n'
            '        <div class="form__error"></div>\n'
            '%s'
            '        <button class="btn btn--block" type="submit" data-magnetic="0.25">'
            '<span class="btn__label">%s</span><i class="btn__arrow"></i></button>\n'
            '      </form>\n'
            '      <p class="auth__foot">%s</p>\n'
            '      <div class="demo-keys" data-demo-keys></div>\n'
            '    </div>\n'
            '  </div>\n'
            '  <aside class="auth__aside">%s</aside>\n'
            '</div>\n'
            '</main>\n' % (slug, title, h1, sub, kind, fields, submit, foot,
                           AUTH_ASIDE % aside) +
            AUTH_SCRIPTS + '\n</body>\n</html>\n')


def field(fid, label, typ, placeholder='', extra=''):
    return ('        <div class="field">\n'
            '          <label for="%s">%s</label>\n'
            '          <input id="%s" name="%s" type="%s" placeholder="%s" autocomplete="%s">\n'
            '%s'
            '          <span class="field__error"></span>\n'
            '        </div>\n'
            % (fid, label, fid, fid, typ, placeholder,
               {'email': 'email', 'password': 'current-password', 'text': 'name'}.get(typ, 'off'),
               extra))


PAGES = [
    ('app-dashboard.html', 'Dashboard', 'dashboard', 'Your course dashboard.'),
    ('app-course.html', 'Course', 'course', 'Every level in the AI Web Developer course.'),
    ('app-lesson.html', 'Lesson', 'lesson', 'A lesson in the AI Web Developer course.'),
    ('app-assessment.html', 'Assessment', 'assessment', 'Level assessment.'),
    ('app-project.html', 'Project', 'project', 'Project brief and checklist.'),
    ('app-projects.html', 'Projects', 'project', 'Project briefs.'),
    ('app-progress.html', 'Progress', 'progress', 'Your progress through the course.'),
    ('app-prompts.html', 'Prompt library', 'prompts', 'Every prompt in the course.'),
    ('app-certificate.html', 'Certificate', 'certificate', 'Course completion certificate.'),
    ('app-settings.html', 'Settings', 'settings', 'Your account settings.'),
]


def write(path, content):
    io.open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(content)
    print('  →', path, '%.1f KB' % (len(content.encode('utf-8')) / 1024))


def main():
    print('build · academy pages')
    for slug, title, view, desc in PAGES:
        write(slug, app_page(slug, title, view, desc))

    write('login.html', auth_page(
        'login.html', 'Log in', 'login', 'Welcome back.', 'Continue building.',
        field('email', 'Email', 'email', 'you@example.com') +
        field('password', 'Password', 'password', '••••••••'),
        'Log in',
        '<a href="reset.html">Forgot password?</a> · '
        'Don\'t have an account? <a href="signup.html">Create one</a>',
        'From your first prompt to your first complete website.'))

    write('signup.html', auth_page(
        'signup.html', 'Create account', 'signup', 'Start building with AI.',
        'Create your KM.dev account and start learning how to build real websites with Claude.',
        field('name', 'Name', 'text', 'Your name') +
        field('email', 'Email', 'email', 'you@example.com') +
        field('password', 'Password', 'password', 'At least 8 characters',
              '          <span class="pw" data-score="0"><i></i><i></i><i></i><i></i></span>\n') +
        field('confirm', 'Confirm password', 'password', 'Repeat it'),
        'Create account',
        'Already have an account? <a href="login.html">Log in</a>',
        'Eight levels. One project. A site that is actually online at the end.'))

    write('reset.html', auth_page(
        'reset.html', 'Reset password', 'reset', 'Reset your password.',
        'Enter the address on your account and a reset link will be sent to it.',
        field('email', 'Email', 'email', 'you@example.com'),
        'Send reset link',
        'Remembered it? <a href="login.html">Log in</a>',
        'Nothing about your password is ever stored in this website’s code.'))

    body = io.open(os.path.join(ROOT, 'build', 'readme-academy.main.html'), encoding='utf-8').read()
    write('README-academy.html',
          head('Setup', 'How to connect the KM.dev Academy backend.') + NAV +
          '\n<main class="page-main" id="main" data-page="README-academy.html" data-space="app">\n' +
          body + '</main>\n' + FOOTER + '\n' + AUTH_SCRIPTS + '\n</body>\n</html>\n')

    write('admin.html',
          head('Admin', 'KM.dev Academy administration.') + NAV +
          '\n<main class="page-main" id="main" data-page="admin.html" data-space="app">\n'
          '  <section class="app"><div class="shell">\n'
          '    <div class="app__head"><div><span class="t-tag">KM.dev Admin</span>'
          '<h1 class="app__title" style="margin-top:12px">Course management</h1></div>'
          '<a class="btn btn--ghost btn--sm" href="app-dashboard.html">'
          '<span class="btn__label">Student view</span><i class="btn__arrow"></i></a></div>\n'
          '    <div data-admin></div>\n'
          '  </div></section>\n'
          '</main>\n' + FOOTER + '\n' + ADMIN_SCRIPTS + '\n</body>\n</html>\n')


if __name__ == '__main__':
    main()
