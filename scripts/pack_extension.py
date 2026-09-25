"""Package extensions/ into frontend/public/braincoach-extension.zip for the in-app setup guide.

Local build (talks to localhost:3000 / localhost:5000):
    python scripts/pack_extension.py
Production build (upload the zip to the Chrome Web Store):
    python scripts/pack_extension.py --app-url https://your-app.vercel.app
With --app-url the extension only matches that origin and reaches the API through its /api proxy,
so no other host permissions are needed.
"""
import argparse
import json
import pathlib
import zipfile
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument('--app-url', help='Production web app origin, e.g. https://braincoach.vercel.app')
args = parser.parse_args()

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'extensions'
out = root / 'frontend' / 'public' / 'braincoach-extension.zip'

overrides = {}
if args.app_url:
    parsed = urlparse(args.app_url)
    if parsed.scheme != 'https' or not parsed.netloc:
        raise SystemExit('--app-url must be an https origin, e.g. https://braincoach.vercel.app')
    origin = f'https://{parsed.netloc}'
    pattern = f'{origin}/*'

    manifest = json.loads((src / 'manifest.json').read_text(encoding='utf-8'))
    manifest['host_permissions'] = [pattern]
    for script in manifest['content_scripts']:
        script['matches'] = [pattern]
    overrides['manifest.json'] = json.dumps(manifest, indent=2)

    state = (src / 'lib' / 'state.js').read_text(encoding='utf-8')
    replacements = {
        "export const APP_URL_PATTERNS = ['http://localhost:3000/*', 'http://127.0.0.1:3000/*']":
            f"export const APP_URL_PATTERNS = ['{pattern}']",
        "export const APP_SESSION_URL = 'http://localhost:3000/session'":
            f"export const APP_SESSION_URL = '{origin}/session'",
        "export const DEFAULT_API = 'http://localhost:5000'":
            f"export const DEFAULT_API = '{origin}/api'",
    }
    for old, new in replacements.items():
        if old not in state:
            raise SystemExit(f'extensions/lib/state.js changed; update pack_extension.py (missing: {old})')
        state = state.replace(old, new)
    overrides['lib/state.js'] = state

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.rglob('*')):
        if f.is_file() and not f.name.endswith('.py'):
            rel = f.relative_to(src).as_posix()
            # Everything inside a top-level "braincoach-extension" folder: that's the folder users pick in Chrome.
            arc = f'braincoach-extension/{rel}'
            if rel in overrides:
                z.writestr(arc, overrides[rel])
            else:
                z.write(f, arc)

print(f'wrote {out} ({out.stat().st_size // 1024} KB)' + (f' for {args.app_url}' if args.app_url else ' for localhost'))
