"""Update the public price snapshot from publisher files (Python 3.10+, openpyxl)."""
import argparse
import calendar
import csv
import hashlib
import io
import json
import math
import os
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist/data/prices.json"
WB_PAGE = "https://www.worldbank.org/en/research/commodity-markets"
WB_FALLBACK = ("https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-"
               "0050012026/related/CMO-Historical-Data-Monthly.xlsx")
ACER = "https://aegis.acer.europa.eu/terminal/price_assessments"
FUEL = "https://storage.data.gov.my/commodities/fuelprice.csv"
AEMO = "https://www.nemweb.com.au/Reports/CURRENT/STTM/int651_v1_ex_ante_market_price_rpt_1.csv"
AEMO_PAGE = "https://www.aemo.com.au/energy-systems/gas/short-term-trading-market-sttm/data-sttm/daily-sttm-reports"
WB_IDS = {"CRUDE_BRENT":"brent", "CRUDE_WTI":"wti", "CRUDE_DUBAI":"dubai",
          "NGAS_US":"henry", "NGAS_EUR":"ttf", "NGAS_JP":"japanlng",
          "COAL_AUS":"newcastle", "COAL_SAFRICA":"richards"}
WB_NAMES = {"Crude oil, Brent":"brent", "Crude oil, WTI":"wti", "Crude oil, Dubai":"dubai",
            "Natural gas, US":"henry", "Natural gas, U.S.":"henry", "Natural gas, Europe":"ttf",
            "Liquefied natural gas, Japan":"japanlng", "Coal, Australian":"newcastle",
            "Coal, South African":"richards"}
FUEL_IDS = ("ron95", "ron97", "diesel", "ron95_budi95", "ron95_skps", "diesel_skds", "diesel_budi")


def fetch(url):
    req = Request(url, headers={"User-Agent":"MarketReplay/1.0", "Accept":"*/*"})
    with urlopen(req, timeout=35) as response:
        if urlsplit(response.geturl())[:2] != urlsplit(url)[:2]:
            raise ValueError("Publisher download changed origin")
        data = response.read(24_000_001)
    if not data or len(data) > 24_000_000:
        raise ValueError("Unexpected document size")
    return data


def add(out, key, day, value):
    try:
        number = float(value)
    except (ValueError, TypeError):
        return
    if math.isfinite(number):
        out.setdefault(key, {})[day.isoformat()] = number


class PublicTable(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = self.cell = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "a":
            self.links.append(dict(attrs).get("href") or "")

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append("".join(self.cell).strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = self.cell = None


def parse_wb(raw):
    from openpyxl import load_workbook
    workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    out = {}
    try:
        sheet = workbook["Monthly Prices"]
        indices = {}
        for row in sheet.values:
            for i, val in enumerate(row):
                if val in WB_IDS or val in WB_NAMES:
                    indices[i] = WB_IDS.get(val) or WB_NAMES[val]
            first = row[0] if row else None
            match = re.fullmatch(r"(\d{4})M(\d{2})", str(first))
            if match:
                year, month = map(int, match.groups())
            elif isinstance(first, date):
                year, month = first.year, first.month
            else:
                continue
            day = date(year, month, calendar.monthrange(year, month)[1])
            for i, key in indices.items():
                if i < len(row):
                    add(out, key, day, row[i])
    finally:
        workbook.close()
    return out


def world_bank():
    file_url = WB_FALLBACK
    try:
        page = PublicTable()
        page.feed(fetch(WB_PAGE).decode("utf-8"))
        for link in page.links:
            parsed = urlsplit(urljoin(WB_PAGE, link))
            if (parsed.scheme == "https" and (parsed.hostname or "").endswith(".worldbank.org")
                    and parsed.path.lower().endswith("/cmo-historical-data-monthly.xlsx")):
                file_url = parsed.geturl()
                break
    except (ValueError, OSError, UnicodeError):
        pass
    return parse_wb(fetch(file_url))


def parse_acer(raw):
    page = PublicTable()
    page.feed(raw.decode("utf-8-sig"))
    out = {}
    fields = {"nwe": "north-west europe price", "southlng": "south europe price", "eulng": "eu price"}
    columns = {}
    for row in page.rows:
        if row and row[0].lower() == "date":
            headers = [" ".join(cell.lower().split()) for cell in row]
            columns = {key: headers.index(f"{name} (eur/mwh)") for key, name in fields.items()
                       if f"{name} (eur/mwh)" in headers}
            continue
        if len(columns) != len(fields) or len(row) <= max(columns.values()) or not re.fullmatch(r"\d{4}[.]\d{2}[.]\d{2}", row[0]):
            continue
        day = date.fromisoformat(row[0].replace(".", "-"))
        for key, col in columns.items():
            add(out, key, day, row[col])
    if not out:
        raise ValueError("Unknown ACER price table or currency unit")
    return out


def parse_fuel(raw):
    out = {}
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        if row["series_type"] == "level":
            day = date.fromisoformat(row["date"])
            for key in FUEL_IDS:
                add(out, key, day, row.get(key))
    return out


def parse_aemo(raw):
    out = {}
    lines = iter(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
    header = next(([s.strip().lower() for s in row] for row in lines
                   if "ex_ante_market_price" in [s.strip().lower() for s in row]), [])
    for values in lines:
        row = dict(zip(header, values))
        city = next((name for name in ("sydney", "adelaide", "brisbane")
                     if name in row.get("hub_name", "").lower()), None)
        if not city:
            continue
        for fmt in ("%d %b %Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d %H:%M:%S"):
            try:
                day = datetime.strptime(row["gas_date"].strip(), fmt).date()
                break
            except ValueError:
                continue
        else:
            raise ValueError("Unknown AEMO gas date")
        add(out, city, day, row["ex_ante_market_price"])
    return out


SOURCES = {
    "world-bank": (world_bank, set(WB_IDS.values())),
    "acer": (lambda: parse_acer(fetch(ACER)), {"nwe", "southlng", "eulng"}),
    "aemo": (lambda: parse_aemo(fetch(AEMO)), {"sydney", "brisbane", "adelaide"}),
    "malaysia": (lambda: parse_fuel(fetch(FUEL)), set(FUEL_IDS)),
}


def apply_updates(series, updates, source, checked_at):
    for entry in series:
        key = entry["id"]
        if key not in updates:
            continue
        if source == "aemo" and entry["cadence"] != "Daily":
            entry.update(history=[], cadence="Daily", source="AEMO", url=AEMO_PAGE,
                         note="Day-ahead wholesale gas price for the delivery gas day.")
        by_date = {row["date"]:row for row in entry["history"]}
        for day, value in updates[key].items():
            previous = by_date.get(day)
            if previous and previous["value"] == value:
                continue
            row = {"date":day, "value":value, "observedAt":checked_at}
            if previous:
                row["priorVersions"] = previous.get("priorVersions", []) + [
                    {k:v for k,v in previous.items() if k != "priorVersions"}]
            by_date[day] = row
        entry["history"] = [by_date[day] for day in sorted(by_date)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=list(SOURCES), action="append")
    parser.add_argument("--output", type=Path, default=OUTPUT, help="Existing snapshot to update")
    args = parser.parse_args()
    original = args.output.read_bytes()
    series = json.loads(original)
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failures = 0
    successes = 0
    with ThreadPoolExecutor(max_workers=4) as executor:
        jobs = {name:executor.submit(SOURCES[name][0]) for name in args.source or SOURCES}
        for name, job in jobs.items():
            try:
                updates = job.result()
                if set(updates) != SOURCES[name][1] or not all(updates.values()):
                    raise ValueError("Missing expected series in published source")
                apply_updates(series, updates, name, stamp)
                print(name, "OK", sum(len(items) for items in updates.values()), "observations")
                successes += 1
            except Exception as exc:
                failures += 1
                print(f"{name}: retaining existing snapshot ({exc})")
    if successes:
        with tempfile.NamedTemporaryFile(mode="w", dir=args.output.parent, delete=False) as tmp:
            json.dump(series, tmp, ensure_ascii=False, indent=2, allow_nan=False)
            tmp.write("\n")
        if hashlib.sha256(args.output.read_bytes()).digest() != hashlib.sha256(original).digest():
            os.unlink(tmp.name)
            raise RuntimeError("Snapshot already changed during refresh. Retry.")
        os.replace(tmp.name, args.output)
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
