"""Turn the Word-exported HTML into normalised question JSON."""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict

from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BUILD, HTML_DIR, MEDIA_DIR, QUESTIONS_DIR, ROOT, norm_ws  # noqa: E402
from inline import Atom, flatten, render, slice_atoms, text_of  # noqa: E402

Q_START = re.compile(r"^(?:C[âa]u|B[àa]i)\s*(\d+)\s*[:.)\-]?\s", re.I)
OPT_MARK = re.compile(r"(?:(?<=^)|(?<=[\s.,;:)\]]))([A-D])\s*[.)]\s")
DS_ITEM = re.compile(r"^([a-d])\s*[.)]\s")
OPT_A_START = re.compile(r"^A\s*[.)]\s")
SOLUTION_MARK = re.compile(
    r"^(?:L[ờo]i gi[ảa]i|H[ướu]ng d[ẫa]n gi[ảa]i"
    r"|HD gi[ảa]i|Gi[ảa]i chi ti[ếe]t)\b", re.I)
SHORT_MARK = re.compile(r"^Tr[ảa] l[ờo]i\s*[:.]", re.I)
# Worked solutions usually end with "Chọn D" / "Đáp án: B"
PICK_MARK = re.compile(
    r"(?:Ch[oọ]n|Đ[áa]p\s*[áa]n|ĐA)\s*(?:đ[áa]p\s*[áa]n\s*)?[:.]?\s*"
    r"([A-D])(?![\wÀ-ỹ])")
GRID_MARK = re.compile(r"[ĐD][ÁA]P\s*[ÁA]N", re.I)
TRUE_WORDS = {"đúng", "dung", "d", "đ", "true", "t"}
FALSE_WORDS = {"sai", "s", "false", "f"}


# --------------------------------------------------------------------------
# blocks

def read_blocks(soup):
    """Top-level flow of the document as paragraph and table blocks."""
    body = soup.body or soup
    blocks = []
    for el in body.find_all(["p", "table", "li", "h1", "h2", "h3"]):
        if el.find_parent("table") is not None:
            continue
        if el.name == "table":
            blocks.append({"kind": "table", "node": el, "atoms": [],
                           "text": norm_ws(el.get_text(" "))})
            continue
        atoms = flatten(el)
        text = norm_ws(text_of(atoms))
        if not text and not any(a.kind == "img" for a in atoms):
            continue
        blocks.append({"kind": "p", "node": el, "atoms": atoms, "text": text})
    return blocks


# --------------------------------------------------------------------------
# answer grids ("DAP AN" tables)

def _is_num(c):
    return bool(re.fullmatch(r"\d{1,3}", c))


def _is_letter(c):
    return bool(re.fullmatch(r"[A-Da-d]", c))


def parse_grid(table):
    """Map question number -> letter from an answer-key table, or None."""
    rows = []
    for tr in table.find_all("tr"):
        rows.append([norm_ws(td.get_text(" ")) for td in tr.find_all(["td", "th"])])
    rows = [r for r in rows if any(c for c in r)]
    if not rows:
        return None
    mapping = {}

    # layout 1: a row of numbers directly above a row of letters
    for i in range(len(rows) - 1):
        top, bot = rows[i], rows[i + 1]
        pairs = [(a, b) for a, b in zip(top, bot) if _is_num(a) and _is_letter(b)]
        if len(pairs) >= 2 and len(pairs) >= len(top) - 2:
            mapping.update({int(a): b.upper() for a, b in pairs})

    # layout 2: "1 A", "2 C", ... down a column pair
    if not mapping:
        for r in rows:
            for a, b in zip(r, r[1:]):
                if _is_num(a) and _is_letter(b):
                    mapping[int(a)] = b.upper()

    # layout 3: numbers then letters interleaved inside a single row
    if not mapping:
        for r in rows:
            cells = [c for c in r if c]
            half = len(cells) // 2
            if half >= 2 and all(_is_num(c) for c in cells[:half]) \
                    and all(_is_letter(c) for c in cells[half:2 * half]):
                mapping.update({int(a): b.upper()
                                for a, b in zip(cells[:half], cells[half:])})

    # layout 4: number and letter share one cell - "1 B", "01. B", "12-C"
    if not mapping:
        pairs = 0
        cells = 0
        for r in rows:
            for c in r:
                if not c:
                    continue
                cells += 1
                m = re.fullmatch(r"(\d{1,3})\s*[.:)\-]?\s*([A-Da-d])\.?", c)
                if m:
                    mapping[int(m.group(1))] = m.group(2).upper()
                    pairs += 1
        # a table of ordinary content can hold a stray "1 A"; demand a majority
        if pairs < 3 or pairs < cells * 0.6:
            mapping = {}
    return mapping or None


def collect_grids(blocks):
    """Merge every answer-key table found in the document."""
    grid = {}
    for i, b in enumerate(blocks):
        if b["kind"] != "table":
            continue
        near = " ".join(x["text"] for x in blocks[max(0, i - 3):i])
        m = parse_grid(b["node"])
        if not m:
            continue
        # a bare 4-cell Dung/Sai table is not an answer key
        if len(m) < 3 and not GRID_MARK.search(near):
            continue
        grid.update(m)
    return grid


def parse_truefalse_table(table):
    """['a) Dung', 'b) Sai', ...] -> {'a': True, 'b': False, ...} or None."""
    cells = [norm_ws(td.get_text(" "))
             for td in table.find_all(["td", "th"]) if norm_ws(td.get_text(" "))]
    out = {}
    for c in cells:
        m = re.match(r"^([a-d])\s*[.)]?\s*(.+)$", c, re.I)
        if not m:
            continue
        val = m.group(2).strip().lower().rstrip(".")
        if val in TRUE_WORDS:
            out[m.group(1).lower()] = True
        elif val in FALSE_WORDS:
            out[m.group(1).lower()] = False
    return out if len(out) >= 2 else None


# --------------------------------------------------------------------------
# option splitting

def find_option_spans(atoms):
    """Locate an ascending A/B/C/D run; returns [(letter, start, marker_end, end)]."""
    text = text_of(atoms)
    hits = [(m.group(1).upper(), m.start(), m.end()) for m in OPT_MARK.finditer(text)]
    if not hits:
        return []
    best = []
    for i in range(len(hits)):
        if hits[i][0] != "A":
            continue
        run, want = [hits[i]], "B"
        for h in hits[i + 1:]:
            if h[0] == want:
                run.append(h)
                if want == "D":
                    break
                want = chr(ord(want) + 1)
        if len(run) > len(best):
            best = run
        if len(best) == 4:
            break
    if len(best) < 3:
        # some documents lost the "A." marker in conversion; a B/C/D run then
        # means option A is whatever precedes B on the same line
        for i in range(len(hits)):
            if hits[i][0] != "B":
                continue
            run, want = [hits[i]], "C"
            for h in hits[i + 1:]:
                if h[0] == want:
                    run.append(h)
                    if want == "D":
                        break
                    want = chr(ord(want) + 1)
            if len(run) == 3 and run[0][1] > 0:
                best = [("A", 0, 0), *run]
                break
    if len(best) < 2:
        return []
    spans = []
    for j, (letter, s, e) in enumerate(best):
        end = best[j + 1][1] if j + 1 < len(best) else len(text)
        spans.append((letter, s, e, end))
    return spans


def find_pick(blocks, skip_first=True):
    """Last explicit 'Chọn X' in a question's own blocks, if any."""
    letter = None
    for b in blocks[1:] if skip_first else blocks:
        for m in PICK_MARK.finditer(b["text"]):
            letter = m.group(1)
    return letter


def option_atoms(atoms, spans):
    """[(letter, marker_atoms, body_atoms)] for each detected option."""
    return [(letter, slice_atoms(atoms, s, e), slice_atoms(atoms, e, end))
            for letter, s, e, end in spans]


# --------------------------------------------------------------------------
# formatting-based answer detection

def _sig_color(atoms):
    vals = Counter()
    for a in atoms:
        if a.kind == "text" and not a.text.strip():
            continue
        vals[a.color] += 1
    return vals.most_common(1)[0][0] if vals else None


def _sig_underline(atoms):
    vals = Counter()
    for a in atoms:
        if a.kind == "text" and not a.text.strip():
            continue
        vals["u" in a.marks] += 1
    return vals.most_common(1)[0][0] if vals else None


def _sig_highlight(atoms):
    for a in atoms:
        if a.kind == "text" and not a.text.strip():
            continue
        if a.highlight:
            return a.highlight
    return None


def detect_by_format(opts):
    """Return (letter, how) when exactly one option is formatted differently."""
    for how, sig in (("highlight", _sig_highlight), ("color", _sig_color),
                     ("underline", _sig_underline)):
        for scope in ("marker", "body", "both"):
            sigs = []
            for letter, marker, body in opts:
                src = marker if scope == "marker" else (
                    body if scope == "body" else marker + body)
                sigs.append((letter, sig(src)))
            counts = Counter(k for _, k in sigs)
            odd = [k for k, n in counts.items() if n == 1]
            if len(counts) != 2 or len(odd) != 1:
                continue
            target = odd[0]
            if how == "underline" and target is not True:
                continue
            if how in ("color", "highlight") and target is None:
                continue
            letter = next(l for l, k in sigs if k == target)
            return letter, "%s:%s" % (how, scope)
    return None, None


# --------------------------------------------------------------------------
# media

def build_media_map(html_path, images, stats):
    """Copy referenced images into build/media, keyed by content hash."""
    base = os.path.dirname(html_path)
    mapping = {}
    for a in images:
        if not a.src or a.src in mapping:
            continue
        src = os.path.normpath(os.path.join(base, a.src.replace("/", os.sep)))
        if not os.path.exists(src):
            stats["missing_media"] += 1
            continue
        with open(src, "rb") as f:
            data = f.read()
        h = hashlib.sha1(data).hexdigest()
        ext = os.path.splitext(src)[1].lower() or ".gif"
        rel = "%s/%s%s" % (h[:2], h, ext)
        dest = os.path.join(MEDIA_DIR, rel.replace("/", os.sep))
        if not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(src, dest)
            stats["media_written"] += 1
        else:
            stats["media_deduped"] += 1
        mapping[a.src] = "/media/" + rel
    return mapping


# --------------------------------------------------------------------------
# per-document parse

def strip_label(atoms, match):
    """Drop the leading 'Cau N:' run from a paragraph's atoms."""
    raw = text_of(atoms)
    cut = len(match.group(0))
    # match ran against the whitespace-normalised text, so re-locate the end
    probe = re.match(r"^\s*(?:C[âa]u|B[àa]i)\s*\d+\s*[:.)\-]?\s*", raw, re.I)
    if probe:
        cut = probe.end()
    return slice_atoms(atoms, cut, len(raw))


def parse_question(blocks, grid):
    head = blocks[0]
    m = Q_START.match(head["text"])
    num = int(m.group(1))

    sol_at = next((j for j, b in enumerate(blocks)
                   if b["kind"] == "p" and SOLUTION_MARK.match(b["text"])), None)
    body = blocks[:sol_at] if sol_at is not None else blocks
    solution = blocks[sol_at + 1:] if sol_at is not None else []

    head_atoms = strip_label(head["atoms"], m)
    para_atoms = [head_atoms] + [b["atoms"] for b in body[1:] if b["kind"] == "p"]
    para_idx = [0] + [j for j, b in enumerate(body) if j and b["kind"] == "p"]

    para_texts = [norm_ws(text_of(a)) for a in para_atoms]
    # options may share one paragraph or take one paragraph each
    opt_pos = next((k for k, atoms in enumerate(para_atoms)
                    if find_option_spans(atoms) or OPT_A_START.match(para_texts[k])),
                   None)
    merged, spans = [], []
    if opt_pos is not None:
        merged = list(para_atoms[opt_pos])
        spans = find_option_spans(merged)
        k = opt_pos + 1
        while len(spans) < 4 and k < len(para_atoms):
            j = para_idx[k]
            if Q_START.match(body[j]["text"]) or SOLUTION_MARK.match(body[j]["text"]):
                break
            cand = merged + [Atom("text", " ")] + para_atoms[k]
            cand_spans = find_option_spans(cand)
            if len(cand_spans) <= len(spans):
                break
            merged, spans = cand, cand_spans
            k += 1
        if len(spans) < 2:
            opt_pos, spans = None, []
    ds_pos = [k for k, j in enumerate(para_idx)
              if DS_ITEM.match(body[j]["text"])]
    ds_table = next((b for b in blocks if b["kind"] == "table"
                     and parse_truefalse_table(b["node"])), None)

    q = {"num": num, "flags": [], "answer_source": None,
         "solution_blocks": solution}

    if len(ds_pos) >= 3 and (opt_pos is None or ds_pos[0] < opt_pos):
        q["type"] = "truefalse"
        q["stem_blocks"] = para_atoms[:ds_pos[0]] or [head_atoms]
        q["items"] = []
        for k in ds_pos:
            atoms = para_atoms[k]
            raw = text_of(atoms)
            mm = re.match(r"^\s*[a-d]\s*[.)]\s*", raw, re.I)
            q["items"].append({
                "label": body[para_idx[k]]["text"][0].lower(),
                "atoms": slice_atoms(atoms, mm.end() if mm else 0, len(raw))})
        key = parse_truefalse_table(ds_table["node"]) if ds_table else None
        if key and all(key.get(it["label"]) is not None for it in q["items"]):
            q["answer"] = {it["label"]: key[it["label"]] for it in q["items"]}
            q["answer_source"] = "table"
        else:
            q["answer"] = None
    elif opt_pos is not None:
        q["type"] = "mcq"
        stem = para_atoms[:opt_pos]
        if opt_pos == 0:
            stem = [slice_atoms(head_atoms, 0, spans[0][1])]
        q["stem_blocks"] = stem or [head_atoms]
        q["options"] = option_atoms(merged, spans)
        letter, how = detect_by_format(q["options"])
        pick = find_pick(blocks)
        if num in grid:
            q["answer"] = grid[num]
            q["answer_source"] = "grid"
            if letter and letter != grid[num]:
                q["flags"].append("grid_vs_format:%s/%s" % (grid[num], letter))
        elif pick:
            q["answer"] = pick
            q["answer_source"] = "pick"
            if letter and letter != pick:
                q["flags"].append("pick_vs_format:%s/%s" % (pick, letter))
        elif letter:
            q["answer"] = letter
            q["answer_source"] = how
        else:
            q["answer"] = None
        if len(spans) != 4:
            q["flags"].append("options:%d" % len(spans))
    elif any(SHORT_MARK.match(body[j]["text"]) for j in para_idx):
        q["type"] = "short"
        q["stem_blocks"] = [a for k, a in enumerate(para_atoms)
                            if not SHORT_MARK.match(body[para_idx[k]]["text"])]
        q["answer"] = None
    else:
        q["type"] = "essay"
        q["stem_blocks"] = para_atoms
        q["answer"] = None

    if q.get("answer") in (None, {}):
        q["status"] = "needs_review"
        q["flags"].append("no_answer")
    else:
        q["status"] = "ok"
    return q


def render_question(q, media):
    q["stem_html"] = " ".join(
        h for h in (render(a, media) for a in q.pop("stem_blocks")) if h)
    sol = q.pop("solution_blocks")
    parts = []
    for b in sol:
        if b["kind"] != "p":
            continue
        h = render(b["atoms"], media)
        if h:
            parts.append("<p>%s</p>" % h)
    q["solution_html"] = "".join(parts)
    if q["type"] == "mcq":
        q["options"] = [{"label": l, "html": render(body, media)}
                        for l, _marker, body in q["options"]]
    elif q["type"] == "truefalse":
        q["items"] = [{"label": it["label"], "html": render(it["atoms"], media)}
                      for it in q["items"]]
    return q


def parse_document(html_path, subject, source_rel, stats):
    with open(html_path, "rb") as f:
        soup = BeautifulSoup(f.read(), "lxml")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    blocks = read_blocks(soup)
    grid = collect_grids(blocks)

    starts = [i for i, b in enumerate(blocks)
              if b["kind"] == "p" and Q_START.match(b["text"])]
    questions = []
    for k, i in enumerate(starts):
        end = starts[k + 1] if k + 1 < len(starts) else len(blocks)
        questions.append(parse_question(blocks[i:end], grid))

    images = [a for b in blocks for a in b["atoms"] if a.kind == "img"]
    media = build_media_map(html_path, images, stats)
    for q in questions:
        render_question(q, media)

    title = next((b["text"] for b in blocks[:6]
                  if b["text"] and not Q_START.match(b["text"])), "")
    return {"source": source_rel, "html": os.path.relpath(html_path, ROOT),
            "subject": subject, "title": title[:200],
            "has_answer_grid": bool(grid), "questions": questions}


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", default=[])
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf8")

    with open(os.path.join(HTML_DIR, "_done.json"), encoding="utf8") as f:
        done = json.load(f)

    os.makedirs(QUESTIONS_DIR, exist_ok=True)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    stats = Counter()
    report = []
    per_subject = defaultdict(Counter)

    for src_rel, info in sorted(done.items()):
        if not info.get("ok"):
            report.append("- KHONG CHUYEN DOI DUOC: `%s` - %s"
                          % (src_rel, info.get("error", "")[:150]))
            continue
        if args.only and not any(o.lower() in src_rel.lower() for o in args.only):
            continue
        html_path = os.path.join(ROOT, info["html"])
        try:
            doc = parse_document(html_path, info["subject"], src_rel, stats)
        except Exception as e:  # noqa: BLE001 - one bad file must not stop the run
            report.append("- LOI PARSE: `%s` - %r" % (src_rel, e))
            print("LOI", src_rel, repr(e))
            continue
        name = os.path.splitext(os.path.basename(info["html"]))[0]
        out = os.path.join(QUESTIONS_DIR, "%s__%s.json" % (info["subject"], name))
        with open(out, "w", encoding="utf8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)

        qs = doc["questions"]
        c = per_subject[info["subject"]]
        c["files"] += 1
        c["questions"] += len(qs)
        for q in qs:
            c[q["type"]] += 1
            if q["status"] == "ok":
                c["answered"] += 1
        stats["files"] += 1
        stats["questions"] += len(qs)
        if not qs:
            report.append("- 0 CAU: `%s`" % src_rel)
        else:
            miss = sum(1 for q in qs if q["status"] != "ok")
            if miss > len(qs) * 0.3:
                report.append("- THIEU DAP AN %d/%d: `%s`" % (miss, len(qs), src_rel))
        print("%-4s %5d cau  %s" % (info["subject"], len(qs), name[:60]))

    lines = ["# Bao cao trich xuat", ""]
    lines.append("| Mon | File | Cau | Co dap an | mcq | truefalse | short | essay |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for s, c in sorted(per_subject.items()):
        lines.append("| %s | %d | %d | %d | %d | %d | %d | %d |"
                     % (s, c["files"], c["questions"], c["answered"], c["mcq"],
                        c["truefalse"], c["short"], c["essay"]))
    lines += ["", "Anh moi: %d, trung lap: %d, thieu: %d"
              % (stats["media_written"], stats["media_deduped"],
                 stats["missing_media"]), ""]
    lines += ["## Can xem lai", ""] + (report or ["- (khong co)"])
    with open(os.path.join(BUILD, "report.md"), "w", encoding="utf8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines[:10]))


if __name__ == "__main__":
    main()
