# Market Replay

Open **Market-Replay.html** for the self-contained saved edition. It includes the geographic globe, a searchable energy board, AI and energy releases, and both replays. Native history charts work offline. Open a benchmark to inspect prices by mouse, touch or keyboard. The publisher-hosted daily WTI and Brent comparison and source links require an internet connection.

On macOS, double-click **Launch-Market-Replay.command** for the updating edition. It uses Node.js 22+ and opens a loopback-only server. You can also run `npm start` and open http://127.0.0.1:8734. No installation of npm packages or API keys is needed. Leave the process running to refresh on visits and every 30 minutes; individual sources keep their own publication and cache schedules. Cached source snapshots are kept in ~/.market-replay/observations. Source health is available at /refresh-status.json.

The production Worker is built by `npm run build` from the assets in dist and the runtime in src/live.mjs. The build also regenerates the self-contained edition. The Worker reads public publisher documents, maintains per-source caches, and supports a durable BUCKET binding. For unattended production checks, poll the two same-origin published data documents. Historical oil prices are explicitly sourced by fixed contract and dated checkpoint. The board opens on daily and working-day series. Weekly and monthly releases have their own views, and every move is measured against the previous available observation. The two-contract historical chart follows trading dates.

## Sources

- World Bank, Commodity Prices (Pink Sheet), CC BY 4.0. Monthly averages for crude oil, coal, natural gas and Japanese LNG imports.
- ACER TERMINAL. Weekday LNG price assessments in EUR/MWh.
- Australian Energy Market Operator. STTM day-ahead hub prices and published reports. Attribution to AEMO.
- Malaysia Ministry of Finance via data.gov.my. Price of Petroleum & Diesel, CC BY 4.0.
- U.S. EIA via Federal Reserve Bank of St. Louis (FRED). The publisher-hosted widget and interactive comparison show daily WTI Cushing and European Brent spot observations. CME and ICE links open the futures publications.
- Belgium’s FPS Economy and Statbel. Official dated maximum consumer prices including VAT for E10 petrol, B7 diesel and heating oil delivered in bulk. Statbel open data, CC BY 4.0 (https://statbel.fgov.be/en/cc-40).
- News cards link to original publishers. The refreshers use RSS feeds from EIA, OpenAI, Google and NVIDIA.
- Geographic outlines from Natural Earth, public domain. The arcs illustrate geography.

Reference dates indicate the observation or pricing period. Each instrument shows its unit and frequency. The Australian gas fallback is dated 9 February 2026 until a newer publisher file is available. Seed data and news are stored in dist/data. For optional manual refresh, run the two refresh scripts in src before rebuilding; refer to their --help output.
