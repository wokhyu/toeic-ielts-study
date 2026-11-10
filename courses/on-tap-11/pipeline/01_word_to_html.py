"""Convert the Word source documents to filtered HTML using Word automation.

Equations in these files are MS Equation 3.0 OLE objects, so plain text
extraction loses them entirely.  Word renders each one to an image when it
saves as filtered HTML, which is the only lossless route available offline.
"""
import argparse
import json
import os
import re
import sys
import time
import unicodedata

import pythoncom
import win32com.client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "de-on")
OUT = os.path.join(ROOT, "build", "html")
STATE = os.path.join(ROOT, "build", "html", "_done.json")

WD_FORMAT_FILTERED_HTML = 10
MSO_ENCODING_UTF8 = 65001


def slugify(name):
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return re.sub(r"-{2,}", "-", name)[:80]


def sources():
    for subject in sorted(os.listdir(SRC)):
        d = os.path.join(SRC, subject)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith((".doc", ".docx")) and not fn.startswith("~$"):
                yield subject, os.path.join(d, fn)


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding="utf8") as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE, "w", encoding="utf8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1)


def start_word():
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    # msoAutomationSecurityForceDisable - never prompt about macros
    word.AutomationSecurity = 3
    opts = word.DefaultWebOptions()
    opts.Encoding = MSO_ENCODING_UTF8
    opts.OptimizeForBrowser = True
    opts.AllowPNG = True
    opts.RelyOnVML = False
    opts.OrganizeInFolder = True
    opts.UseLongFileNames = True
    return word


def convert(word, path, dest):
    doc = word.Documents.Open(
        os.path.abspath(path), ReadOnly=True, AddToRecentFiles=False,
        Visible=False, ConfirmConversions=False,
    )
    try:
        doc.SaveAs2(os.path.abspath(dest), FileFormat=WD_FORMAT_FILTERED_HTML)
    finally:
        doc.Close(SaveChanges=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="stop after N files")
    ap.add_argument("--only", action="append", default=[],
                    help="substring filter on the source filename")
    ap.add_argument("--force", action="store_true", help="reconvert finished files")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf8")
    os.makedirs(OUT, exist_ok=True)
    state = {} if args.force else load_state()

    todo = []
    for subject, path in sources():
        if args.only and not any(o.lower() in os.path.basename(path).lower()
                                 for o in args.only):
            continue
        key = os.path.relpath(path, ROOT).replace("\\", "/")
        if key in state and state[key].get("ok"):
            continue
        todo.append((subject, path, key))
        if args.limit and len(todo) >= args.limit:
            break

    print(f"{len(todo)} file can chuyen doi")
    if not todo:
        return

    pythoncom.CoInitialize()
    word = start_word()
    try:
        used = {v["html"] for v in state.values() if v.get("html")}
        for i, (subject, path, key) in enumerate(todo, 1):
            stem, ext = os.path.splitext(os.path.basename(path))
            # `foo.doc` and `Foo.docx` both exist in de-on/ and slugify alike
            base = slugify(stem) + ("-doc" if ext.lower() == ".doc" else "")
            outdir = os.path.join(OUT, subject)
            os.makedirs(outdir, exist_ok=True)
            dest = os.path.join(outdir, base + ".html")
            n = 2
            while os.path.relpath(dest, ROOT) in used:
                dest = os.path.join(outdir, f"{base}-{n}.html")
                n += 1
            used.add(os.path.relpath(dest, ROOT))
            t0 = time.time()
            try:
                convert(word, path, dest)
                media = os.path.join(outdir, base + "_files")
                n_media = len(os.listdir(media)) if os.path.isdir(media) else 0
                state[key] = {"ok": True, "html": os.path.relpath(dest, ROOT),
                              "subject": subject, "media": n_media}
                print(f"[{i}/{len(todo)}] {base}  {n_media} media  "
                      f"{time.time() - t0:.1f}s")
            except Exception as e:  # noqa: BLE001 - keep going, report at the end
                state[key] = {"ok": False, "error": repr(e)[:300], "subject": subject}
                print(f"[{i}/{len(todo)}] LOI {base}: {e}")
            save_state(state)
    finally:
        try:
            word.Quit(SaveChanges=0)
        except Exception:
            pass
        pythoncom.CoUninitialize()

    bad = [k for k, v in state.items() if not v.get("ok")]
    print(f"Xong. Loi: {len(bad)}")
    for k in bad:
        print("  ", k, state[k].get("error", "")[:120])


if __name__ == "__main__":
    main()
