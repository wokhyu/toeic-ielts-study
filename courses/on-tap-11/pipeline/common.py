"""Shared helpers for the extraction pipeline."""
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
HTML_DIR = os.path.join(BUILD, "html")
QUESTIONS_DIR = os.path.join(BUILD, "questions")
MEDIA_DIR = os.path.join(BUILD, "media")

SUBJECT_NAMES = {"toan": "Toán", "ly": "Vật lí", "hoa": "Hoá học"}


def slugify(name):
    name = unicodedata.normalize("NFKD", name.replace("đ", "d").replace("Đ", "D"))
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return re.sub(r"-{2,}", "-", name)


def norm_ws(s):
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()
