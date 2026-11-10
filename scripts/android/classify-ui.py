#!/usr/bin/env python3
"""Classify an Android uiautomator dump taken after launching the MenuMinute TWA.

Prints one line: good:<evidence> | bad:<reason> | tap <x> <y> (dismiss a Chrome first-run prompt) | unknown:<why>
Pure text analysis so it can be unit-tested without an emulator (tests/android-ui-classifier.test.ts).
"""
import re
import sys
import xml.etree.ElementTree as ET

BAD = [
    (r"localhost|127\.0\.0\.1", "page is on an internal address (localhost)"),
    (r"ERR_[A-Z_]+", "Chrome network error page"),
    (r"This site can.?t be reached|isn.?t working|Webpage not available|can.?t reach this page", "Chrome error page"),
    (r"Your connection is not private|NET::ERR", "TLS error page"),
]
# MenuMinute-specific content only. Generic words such as "sign in" also appear on Chrome's own
# first-run screen ("Sign in to browse easier across devices") and made an earlier version pass falsely.
GOOD = re.compile(r"welcome back|you@restaurant\.com|your password|menu studio|menuminute dashboard", re.I)
DISMISS = re.compile(r"^(accept (&|and) continue|no thanks|use without an account|got it|skip|not now)$", re.I)


def center(bounds: str):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not m:
        return None
    l, t, r, b = map(int, m.groups())
    return (l + r) // 2, (t + b) // 2


def classify(xml_text: str) -> str:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return "unknown:no UI dump yet"
    texts, taps = [], []
    first_run = False
    for node in root.iter("node"):
        rid = node.get("resource-id") or ""
        if "signin_fre" in rid or "_fre_" in rid or (node.get("text") or "").strip() == "Welcome to Chrome":
            first_run = True
            if "dismiss" in rid and center(node.get("bounds")):
                taps.insert(0, center(node.get("bounds")))
        text = (node.get("text") or "").strip()
        desc = (node.get("content-desc") or "").strip()
        for value in (text, desc):
            if value:
                texts.append(value)
        if DISMISS.match(text) and center(node.get("bounds")):
            taps.append(center(node.get("bounds")))
    # Chrome's first-run screen is never the destination: dismiss it and look again.
    if first_run:
        if taps:
            return f"tap {taps[0][0]} {taps[0][1]}"
        return "unknown:Chrome first-run screen with no dismiss button"
    blob = "\n".join(texts)
    for pattern, reason in BAD:
        if re.search(pattern, blob, re.I):
            return f"bad:{reason}"
    if GOOD.search(blob):
        return "good:" + (GOOD.search(blob).group(0).lower())
    if taps:
        return f"tap {taps[0][0]} {taps[0][1]}"
    return f"unknown:{len(texts)} text nodes, no login content yet"


if __name__ == "__main__":
    try:
        data = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    except OSError:
        data = ""
    print(classify(data))
