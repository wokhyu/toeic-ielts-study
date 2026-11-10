"""Flatten Word's filtered HTML into styled atoms.

Answer keys in the source documents are encoded as formatting (a red option, an
underlined option letter), so the parser needs styling information at the level
of individual text runs.  Working with a flat atom list also makes it possible
to slice a paragraph at a character offset - options are frequently packed into
a single ``<p>`` separated by nothing but whitespace.
"""
import html as html_mod
import re

from bs4 import NavigableString, Tag

MARK_TAGS = {"b", "strong", "i", "em", "u", "sub", "sup"}
TAG_ALIAS = {"strong": "b", "em": "i"}

_COLOR = re.compile(r"(?:^|;)\s*color\s*:\s*([^;]+)", re.I)
_TOP = re.compile(r"(?:^|;)\s*top\s*:\s*(-?[\d.]+)pt", re.I)
_BG = re.compile(r"(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)", re.I)

NAMED_COLORS = {
    "red": "#ff0000", "blue": "#0000ff", "black": "#000000", "green": "#008000",
    "windowtext": "#000000", "auto": "#000000", "maroon": "#800000",
    "purple": "#800080", "navy": "#000080", "fuchsia": "#ff00ff",
}


def _highlight_of(style):
    """Word marks the correct option with a text highlight in many documents."""
    m = _BG.search(style or "")
    if not m:
        return None
    v = m.group(1).strip().lower().split()[0]
    if v in ("none", "transparent", "white", "#ffffff", "auto", "windowtext"):
        return None
    return NAMED_COLORS.get(v, v)


def _color_of(style):
    m = _COLOR.search(style or "")
    if not m:
        return None
    v = m.group(1).strip().lower()
    v = NAMED_COLORS.get(v, v)
    if re.fullmatch(r"#[0-9a-f]{3}", v):
        v = "#" + "".join(c * 2 for c in v[1:])
    if v in ("#000000", "#010101"):
        return None
    return v if v.startswith("#") else None


class Atom:
    __slots__ = ("kind", "text", "marks", "color", "highlight", "src", "width",
                 "height", "top")

    def __init__(self, kind, text="", marks=frozenset(), color=None,
                 src=None, width=None, height=None, top=None, highlight=None):
        self.kind = kind          # 'text' | 'img' | 'break'
        self.text = text
        self.marks = marks
        self.color = color
        self.highlight = highlight
        self.src = src
        self.width = width
        self.height = height
        self.top = top

    @property
    def length(self):
        return len(self.text) if self.kind == "text" else 1

    def __repr__(self):
        return f"Atom({self.kind},{self.text!r},{sorted(self.marks)},{self.color})"


def flatten(node, marks=frozenset(), color=None, top=None, out=None,
            highlight=None):
    """Walk ``node`` and return a list of Atom, preserving document order."""
    out = [] if out is None else out
    for child in node.children:
        if isinstance(child, NavigableString):
            text = str(child).replace("\xa0", " ")
            if text:
                out.append(Atom("text", text, marks, color, highlight=highlight))
        elif isinstance(child, Tag):
            name = child.name.lower()
            if name == "img":
                out.append(Atom(
                    "img", "￼", marks, color,
                    src=child.get("src"), width=child.get("width"),
                    height=child.get("height"), top=top, highlight=highlight,
                ))
                continue
            if name == "br":
                out.append(Atom("break", "\n", marks, color, highlight=highlight))
                continue
            if name in ("script", "style", "o:p"):
                continue
            sub_marks = marks
            if name in MARK_TAGS:
                sub_marks = marks | {TAG_ALIAS.get(name, name)}
            style = child.get("style", "")
            sub_color = _color_of(style) or color
            m = _TOP.search(style)
            sub_top = m.group(1) if m else top
            if "text-decoration" in style.lower() and "underline" in style.lower():
                sub_marks = sub_marks | {"u"}
            sub_hl = _highlight_of(style) or highlight
            flatten(child, sub_marks, sub_color, sub_top, out, sub_hl)
    return out


def text_of(atoms):
    return "".join(a.text for a in atoms)


def offsets(atoms):
    """Character offset of each atom's start, plus the total length."""
    pos, res = 0, []
    for a in atoms:
        res.append(pos)
        pos += a.length
    res.append(pos)
    return res


def slice_atoms(atoms, start, end):
    """Slice by character offset, splitting text atoms at the boundaries."""
    pos, out = 0, []
    for a in atoms:
        n = a.length
        lo, hi = pos, pos + n
        pos = hi
        if hi <= start or lo >= end:
            continue
        if a.kind != "text":
            out.append(a)
            continue
        s = max(start - lo, 0)
        e = min(end - lo, n)
        piece = a.text[s:e]
        if piece:
            out.append(Atom("text", piece, a.marks, a.color,
                            highlight=a.highlight))
    return out


def render(atoms, media_map=None, keep_color=False):
    """Render atoms back to compact HTML."""
    parts, open_marks = [], []

    def close_to(target):
        while open_marks and open_marks[-1] not in target:
            parts.append(f"</{open_marks.pop()}>")

    for a in atoms:
        if a.kind == "break":
            close_to(frozenset())
            parts.append("<br/>")
            continue
        want = {m for m in a.marks if m in ("b", "i", "u", "sub", "sup")}
        # b/i on their own carry no meaning here - the source bolds every option
        if not keep_color:
            want -= {"b"}
        while open_marks and open_marks[-1] not in want:
            parts.append(f"</{open_marks.pop()}>")
        for m in ("sub", "sup", "u", "i", "b"):
            if m in want and m not in open_marks:
                open_marks.append(m)
                parts.append(f"<{m}>")
        if a.kind == "img":
            src = a.src or ""
            if media_map is not None:
                src = media_map.get(src, src)
            attrs = [f'src="{html_mod.escape(src, quote=True)}"', 'class="eq"']
            if a.width:
                attrs.append(f'width="{a.width}"')
            if a.height:
                attrs.append(f'height="{a.height}"')
            if a.top:
                attrs.append(f'style="top:{a.top}pt"')
            parts.append("<img " + " ".join(attrs) + "/>")
        else:
            parts.append(html_mod.escape(a.text))
    while open_marks:
        parts.append(f"</{open_marks.pop()}>")
    out = "".join(parts)
    out = re.sub(r"\s+", " ", out).strip()
    return out
