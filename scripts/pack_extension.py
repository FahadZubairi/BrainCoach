"""Package extensions/ into frontend/public/braincoach-extension.zip for the in-app setup guide.

Run after changing the extension:  python scripts/pack_extension.py
(Not needed once the extension is on the Chrome Web Store: set NEXT_PUBLIC_EXTENSION_URL instead.)
"""
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'extensions'
out = root / 'frontend' / 'public' / 'braincoach-extension.zip'

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.rglob('*')):
        if f.is_file() and not f.name.endswith('.py'):
            # Everything inside a top-level "braincoach-extension" folder: that's the folder users pick in Chrome.
            z.write(f, pathlib.Path('braincoach-extension') / f.relative_to(src))

print(f'wrote {out} ({out.stat().st_size // 1024} KB)')
