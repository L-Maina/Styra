"""Design-gate screenshots: every v2 screen at 390x844 (phone emulation) and 1440x900, graphite and ivory.

    python scripts/v2/screens.py http://localhost:3000 docs/v2/screens

Uses the brand-identity skill's CDP library (Chrome, no Node). Signed-in screens log in with the local seed
accounts (scripts/v2/seed.ts), so run it only against a local or preview database with seed data.
"""
import json, os, sys, urllib.request

sys.path.insert(0, os.path.expanduser('~/styra-brand-work/skill/skills/brand-identity/scripts'))
import cdplib  # noqa: E402

BASE, OUT = sys.argv[1].rstrip('/'), sys.argv[2]
SEED_PASSWORD = 'styra-demo-pass'


def login(email):
    req = urllib.request.Request(f'{BASE}/api/v2/auth/login', data=json.dumps({'email': email, 'password': SEED_PASSWORD}).encode(),
                                 headers={'content-type': 'application/json', 'origin': BASE})
    return json.load(urllib.request.urlopen(req))['data']['token']


SCREENS = [
    ('home', '/', None), ('explore', '/explore?category=BARBER', None), ('business', '/b/kinyozi-pro', None),
    ('signin', '/signin', None), ('bookings', '/bookings', 'amina@example.test'), ('pro', '/pro', 'brian@kinyozi.test'),
    ('pro-hours', '/pro/hours', 'brian@kinyozi.test'), ('admin', '/admin', 'admin@styra.test'), ('not-found', '/b/no-such-place', None),
]
SIZES = [('390', (390, 844), True), ('1440', (1440, 900), False)]

browser, errors = cdplib.launch()
if not browser:
    sys.exit(f'no browser: {errors}')
tokens = {}
os.makedirs(OUT, exist_ok=True)
try:
    for name, path, who in SCREENS:
        for label, viewport, mobile in SIZES:
            for scheme in ('dark', 'light'):
                page = browser.new_page(viewport=viewport, mobile=mobile, has_touch=mobile, color_scheme=scheme, reduced_motion='reduce')
                if who:
                    tokens.setdefault(who, login(who))
                    page.client.conn.call('Network.setCookie', {'name': 'styra_session', 'value': tokens[who], 'url': BASE, 'httpOnly': True}, session=page.session)
                page.goto(f'{BASE}{path}')
                page.screenshot(os.path.join(OUT, f'{name}-{label}-{scheme}.png'))
                page.close()
                print('ok', name, label, scheme)
finally:
    browser._shutdown()
