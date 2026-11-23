#!/usr/bin/env python3
"""Refresh Market Replay from public publisher RSS feeds. Python standard library only."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
import fcntl
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


FEEDS = [
    ("U.S. EIA", "Energy", "https://www.eia.gov/rss/todayinenergy.xml"),
    ("OpenAI", "AI", "https://openai.com/news/rss.xml"),
    ("Google", "AI", "https://blog.google/technology/ai/rss/"),
    ("NVIDIA", "AI", "https://nvidianews.nvidia.com/releases.xml"),
]
ARTICLE_HOSTS = {
    "U.S. EIA": {"www.eia.gov", "eia.gov"},
    "OpenAI": {"openai.com", "www.openai.com"},
    "Google": {"blog.google", "deepmind.google", "research.google", "cloud.google.com", "developers.googleblog.com"},
    "NVIDIA": {"nvidianews.nvidia.com", "blogs.nvidia.com", "developer.nvidia.com"},
    "ACER": {"aegis.acer.europa.eu", "www.acer.europa.eu"},
    "IEA": {"www.iea.org", "iea.org"},
}
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "dist/data/news.json"
MAX_BYTES = 12 * 1024 * 1024


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = False

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.hidden = True

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.hidden = False

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_text(value):
    parser = PlainText()
    parser.feed(value or "")
    return " ".join(" ".join(parser.parts).split())


def article_url(raw, base, source):
    try:
        parts = urlsplit(urljoin(base, raw))
        if parts.netloc.lower() not in ARTICLE_HOSTS.get(source, ()):
            return None
    except ValueError:
        return None
    if parts.scheme not in {"https", "http"}:
        return None
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if not k.lower().startswith("utm_")])
    path = parts.path
    if source == "U.S. EIA":
        path = path.lower()
    return urlunsplit(("https", parts.netloc.lower(), path, query, ""))


def item_id(url):
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def parse_date(raw):
    raw = raw.strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return date.fromisoformat(raw).isoformat()
        try:
            parsed = parsedate_to_datetime(raw)
        except (ValueError, TypeError):
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.date().isoformat()
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError):
        return None


def parse_feed(payload, source, category, feed_url):
    root = ET.fromstring(payload)
    rows = []
    for item in root.findall(".//item") + root.findall("{*}entry"):
        title = plain_text(item.findtext("{*}title"))
        link = item.findtext("{*}link")
        if not (link and link.strip()):
            link = next((e.get("href") for e in item.findall("{*}link")
                         if e.get("rel", "alternate") == "alternate"), None)
        if not link:
            continue
        url = article_url(link, feed_url, source)
        published = parse_date(item.findtext("{*}pubDate") or item.findtext("{*}published")
                               or item.findtext("{*}date") or "")
        if not title or not url or not published or published > datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"):
            continue
        # Public syndication metadata only. Leave the article at its publisher.
        description = plain_text(item.findtext("{*}description") or item.findtext("{*}summary"))
        words = description.split()
        summary = description if len(words) <= 22 else " ".join(words[:22]).rstrip(",.;:") + "…"
        rows.append(dict(id=item_id(url), title=title, summary=summary, url=url,
                         source=source, date=published, category=category))
    if not rows:
        raise ValueError("no dated articles found")
    return rows


def fetch_feed(spec):
    source, category, url = spec
    try:
        request = Request(url, headers={"User-Agent": "MarketReplay/1.0 (public RSS reader)",
                                          "Accept": "application/rss+xml, application/atom+xml, text/xml"})
        with urlopen(request, timeout=20) as res:
            if urlsplit(res.geturl())[:2] != urlsplit(url)[:2]:
                raise ValueError("publisher feed changed origin")
            payload = res.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("feed exceeds size limit")
        return parse_feed(payload, source, category, url)
    except (OSError, ValueError, ET.ParseError) as exc:
        print(f"{source}: preserving previous articles ({exc})", file=sys.stderr)
        return []


def merge_archive(path, additions):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Serialize read/merge/replace across overlapping local refresh processes.
    directory = os.open(path.parent, os.O_RDONLY)
    temp = None
    try:
        fcntl.flock(directory, fcntl.LOCK_EX)
        previous = json.loads(path.read_text()) if path.exists() else []
        by_url = {row["url"]: row for row in previous if article_url(row["url"], "", row["source"])}
        for row in additions:
            # Preserve previously published evidence and original editorial summaries.
            by_url.setdefault(row["url"], row)
        rows = sorted(by_url.values(), key=lambda row: (row["date"], row["url"]), reverse=True)
        if rows == previous:
            return
        with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
            temp = output.name
            json.dump(rows, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.chmod(temp, 0o644)
        os.replace(temp, path)
    finally:
        if temp and os.path.exists(temp):
            os.unlink(temp)
        os.close(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    with ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        batches = list(pool.map(fetch_feed, FEEDS))
    fresh = [row for batch in batches for row in batch]
    if not fresh:
        return 1
    merge_archive(args.output, fresh)
    print(f"Read {len(fresh)} articles from {sum(bool(b) for b in batches)}/{len(FEEDS)} feeds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
