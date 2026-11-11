"""Focused design-prototype check, not framework/runtime acceptance.

Requires Python Playwright and a Chromium executable. No installation performed.
Run from repository root: python3 design/agent-debug/verify.py
Override BROWSER_PATH for another installed Chromium. Outputs results/dx-design/.
"""
import functools
import json
import os
from pathlib import Path
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'results' / 'dx-design'
OUT.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'design' / 'agent-debug')))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
checks = []
errors = []
external = []
url = f'http://127.0.0.1:{server.server_port}'

def checked(name, condition):
    assert condition, name
    checks.append(name)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('BROWSER_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: external.append(r.url) if not r.url.startswith(url) and not r.url.startswith(('data:', 'blob:')) else None)
        page.goto(url)
        checked('persistent synthetic label', page.locator('.demo').is_visible() and '合成資料' in page.locator('.demo').inner_text())
        page.screenshot(path=str(OUT / 'overview.png'), full_page=True)
        page.get_by_role('button', name='查看支持證據', exact=True).click()
        checked('summary opens same run/event', 'demo-run:e1' in page.locator('#detail').inner_text())
        page.get_by_role('button', name='顯示相鄰事件', exact=True).click()
        page.locator('[data-event="demo-run:e3"]').click()
        checked('same-time event is not causal', 'temporal-association' in page.locator('#detail').inner_text() and '不能把它當作' in page.locator('#detail').inner_text())
        page.screenshot(path=str(OUT / 'evidence.png'), full_page=True)
        page.get_by_role('button', name='返回目前判斷', exact=True).click()
        checked('return restores focus', page.evaluate('document.activeElement.id') == 'inspect')
        page.locator('[data-view="evidence"]').focus()
        page.keyboard.press('Enter')
        checked('keyboard navigation preserves selection', 'demo-run:e3' in page.locator('#detail').inner_text())
        page.select_option('#scenario', 'stale')
        checked('stale preserves historical snapshot with warning', '歷史來源快照' in page.locator('#detail').inner_text() and 'historical-only' in page.locator('#badges').inner_text())
        stale = page.evaluate('projection()')
        checked('stale handoff identifies changed revision and affected refs', stale['sourceIdentity']['recordedRevision'] == 'demo-source-r1' and stale['sourceIdentity']['currentRevision'] == 'demo-source-r2' and stale['sourceIdentity']['affectedRefs'] == ['demo-run:e1', 'demo-run:e2'])
        page.select_option('#scenario', 'missing')
        checked('missing source does not guess location', 'unresolved' in page.locator('#detail').inner_text() and page.locator('#detail pre').count() == 0)
        page.locator('[data-view="handoff"]').click()
        payload = json.loads(page.locator('#payload').input_value())
        checked('export matches missing-source state', payload['verdict'] == 'insufficient-evidence' and all(e['source'] is None for e in payload['evidence']))
        checked('export retains contrary event and limitations', len(payload['evidence']) == 3 and any('e3' in x for x in payload['limitations']) and payload['truncated'] is False)
        page.select_option('#scenario', 'interrupted')
        payload = json.loads(page.locator('#payload').input_value())
        checked('deadline is not reset on handoff', payload['execution'] == 'budget-exhausted' and payload['resume']['remainingSeconds'] == 0 and payload['resume']['resetBudget'] is False)
        with page.expect_download() as d:
            page.get_by_role('button', name='下載合成交接 JSON', exact=True).click()
        d.value.save_as(str(OUT / 'handoff.json'))
        checked('download matches displayed projection', json.loads((OUT / 'handoff.json').read_text()) == payload)
        checked('runtime and cost not fabricated', payload['synthetic'] is True and payload['navigation']['externalViewer'] == 'not-implemented' and payload['cost']['tokens'] is None)
        page.set_viewport_size({'width': 390, 'height': 844})
        for view in ['overview', 'evidence', 'experiment', 'handoff']:
            page.locator(f'[data-view="{view}"]').click()
            checked(f'narrow {view} does not overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        page.locator('[data-view="overview"]').click()
        page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
        checked('no external requests', not external)
        checked('no browser errors', not errors)
        result = {'kind': 'dx-design-browser-check', 'browser': browser.version, 'url': url, 'checks': checks, 'errors': errors, 'externalRequests': external, 'scope': 'synthetic prototype only', 'notValidated': ['human usability', 'runtime integration', 'OpenCode 2.2.5 integration', '100ms response', 'real source/trace navigation']}
        (OUT / 'browser-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        browser.close()
finally:
    server.shutdown()
    server.server_close()
