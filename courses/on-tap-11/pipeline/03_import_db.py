"""Load the parsed question JSON into the SQLite database.

Also assigns every source file to a topic using pipeline/taxonomy.yaml, and
drops questions whose content already exists (the source documents overlap
heavily - several files cover the same lesson).
"""
import argparse
import glob
import hashlib
import json
import os
import re
import sqlite3
import sys
from collections import Counter

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BUILD, QUESTIONS_DIR, ROOT  # noqa: E402

DB_PATH = os.path.join(BUILD, "quiz.db")
SCHEMA_SQL = os.path.join(ROOT, "pipeline", "sqlite_schema.sql")
TAXONOMY = os.path.join(ROOT, "pipeline", "taxonomy.yaml")

TAG_RE = re.compile(r"<[^>]+>")
EASY = ("nhan-biet", "muc-thong-hieu", "co-ban", "thong-hieu")
HARD = ("nang-cao", "van-dung-cao", "bdhsg", "vdc")


def plain(html):
    return re.sub(r"\s+", " ", TAG_RE.sub(" ", html or "")).strip().lower()


def content_hash(q):
    parts = [q["type"], plain(q.get("stem_html", ""))]
    for o in q.get("options", []) or q.get("items", []):
        parts.append(o["label"] + "|" + plain(o["html"]))
    return hashlib.sha1("␟".join(parts).encode("utf8")).hexdigest()


def rank(q):
    """How useful a copy of a question is, for picking between duplicates."""
    answer = q.get("answer")
    return (
        2 if answer not in (None, {}) else 0,
        1 if q.get("solution_html") else 0,
        len(q.get("stem_html", "")),
    )


def difficulty_of(source_path):
    name = source_path.lower()
    if any(h in name for h in HARD):
        return 3
    if any(e in name for e in EASY):
        return 1
    return 2


class Taxonomy:
    def __init__(self, path):
        with open(path, encoding="utf8") as f:
            self.data = yaml.safe_load(f)
        self.rules = []  # (subject_slug, pattern, chapter_slug, topic_slug)
        for s in self.data["subjects"]:
            for ch in s["chapters"]:
                for t in ch["topics"]:
                    for pat in t.get("match", []):
                        self.rules.append((s["slug"], pat.lower(),
                                           ch["slug"], t["slug"]))

    def match(self, subject, source_path):
        name = os.path.basename(source_path).lower()
        for subj, pat, ch, topic in self.rules:
            if subj == subject and pat in name:
                return ch, topic
        return None


def ensure_schema(conn):
    have = {r[0] for r in conn.execute(
        "select name from sqlite_master where type='table'")}
    missing = {"subjects", "chapters", "topics", "sources", "questions", "options"}
    if not missing.issubset(have):
        with open(SCHEMA_SQL, encoding="utf-8") as f:
            conn.executescript(f.read())


def seed_taxonomy(conn, tax):
    ids = {}
    for si, s in enumerate(tax.data["subjects"]):
        conn.execute(
            "insert into subjects(slug,name,sort) values(?,?,?) "
            "on conflict(slug) do update set name=excluded.name, sort=excluded.sort",
            (s["slug"], s["name"], si))
        sid = conn.execute("select id from subjects where slug=?",
                           (s["slug"],)).fetchone()[0]
        ids[s["slug"]] = sid
        for ci, ch in enumerate(s["chapters"]):
            conn.execute(
                "insert into chapters(subject_id,slug,name,sort) values(?,?,?,?) "
                "on conflict(subject_id,slug) do update set "
                "name=excluded.name, sort=excluded.sort",
                (sid, ch["slug"], ch["name"], ci))
            cid = conn.execute(
                "select id from chapters where subject_id=? and slug=?",
                (sid, ch["slug"])).fetchone()[0]
            for ti, t in enumerate(ch["topics"]):
                conn.execute(
                    "insert into topics(chapter_id,slug,name,sort) values(?,?,?,?) "
                    "on conflict(chapter_id,slug) do update set "
                    "name=excluded.name, sort=excluded.sort",
                    (cid, t["slug"], t["name"], ti))
                ids[(s["slug"], ch["slug"], t["slug"])] = conn.execute(
                    "select id from topics where chapter_id=? and slug=?",
                    (cid, t["slug"])).fetchone()[0]
    return ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true",
                    help="wipe imported questions before loading")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf8")

    tax = Taxonomy(TAXONOMY)
    os.makedirs(BUILD, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("pragma foreign_keys=on")
    ensure_schema(conn)

    if args.reset:
        conn.execute("delete from attempt_answers")
        conn.execute("delete from attempts")
        conn.execute("delete from question_stats")
        conn.execute("delete from bookmarks")
        conn.execute("delete from options")
        conn.execute("delete from questions")
        conn.execute("delete from sources")

    ids = seed_taxonomy(conn, tax)
    stats = Counter()
    unmatched = []
    seen_hashes = {r[0] for r in conn.execute("select content_hash from questions")}

    # Several documents list a question twice - once bare, once with a worked
    # solution - so collect every copy first and keep the most informative one.
    best = {}
    order = []
    for path in sorted(glob.glob(os.path.join(QUESTIONS_DIR, "*.json"))):
        with open(path, encoding="utf8") as f:
            doc = json.load(f)
        subject = doc["subject"]
        hit = tax.match(subject, doc["source"])
        if not hit:
            unmatched.append(doc["source"])
            stats["files_unmatched"] += 1
        topic_id = ids.get((subject, hit[0], hit[1])) if hit else None
        subject_id = ids[subject]

        conn.execute(
            "insert into sources(path,subject_id,title) values(?,?,?) "
            "on conflict(path) do update set title=excluded.title",
            (doc["source"], subject_id, doc.get("title", "")))
        source_id = conn.execute("select id from sources where path=?",
                                 (doc["source"],)).fetchone()[0]
        diff = difficulty_of(doc["source"])

        for q in doc["questions"]:
            if not plain(q.get("stem_html", "")) and not q.get("options"):
                stats["empty"] += 1
                continue
            h = content_hash(q)
            entry = (q, topic_id, source_id, diff, h)
            if h in best:
                stats["duplicates"] += 1
                if rank(q) > rank(best[h][0]):
                    best[h] = entry
                continue
            best[h] = entry
            order.append(h)

    for key in order:
        q, topic_id, source_id, diff, h = best[key]
        if h in seen_hashes:
            stats["duplicates"] += 1
            continue
        seen_hashes.add(h)
        answer = q.get("answer")
        status = "ok" if answer not in (None, {}) else "needs_review"
        cur = conn.execute(
            "insert into questions(topic_id,source_id,number_in_source,type,"
            "stem_html,solution_html,answer_key,answer_source,difficulty,"
            "content_hash,status,flags) values(?,?,?,?,?,?,?,?,?,?,?,?)",
            (topic_id, source_id, q.get("num", 0), q["type"],
             q.get("stem_html", ""), q.get("solution_html", ""),
             json.dumps(answer, ensure_ascii=False) if answer is not None else None,
             q.get("answer_source"), diff, h, status,
             json.dumps(q.get("flags", []), ensure_ascii=False)))
        qid = cur.lastrowid
        rows = q.get("options") or q.get("items") or []
        for i, o in enumerate(rows):
            conn.execute(
                "insert into options(question_id,label,html,sort) values(?,?,?,?)",
                (qid, o["label"], o["html"], i))
        stats["imported"] += 1
        stats[q["type"]] += 1
        stats[status] += 1

    conn.commit()

    lines = ["", "## Nhap CSDL", "",
             "- Da nhap: %d cau (mcq %d, truefalse %d, short %d, essay %d)"
             % (stats["imported"], stats["mcq"], stats["truefalse"],
                stats["short"], stats["essay"]),
             "- Co dap an: %d, can xem lai: %d"
             % (stats["ok"], stats["needs_review"]),
             "- Bo vi trung noi dung: %d, bo vi rong: %d"
             % (stats["duplicates"], stats["empty"]),
             "- File chua gan chu de: %d" % stats["files_unmatched"], ""]
    lines += ["  - `%s`" % u for u in unmatched]
    text = "\n".join(lines) + "\n"
    with open(os.path.join(BUILD, "report.md"), "a", encoding="utf8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    main()
