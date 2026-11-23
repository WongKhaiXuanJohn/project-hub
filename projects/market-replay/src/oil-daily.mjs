// Official effective prices inclusive of VAT. Each date is supplied by the publisher.
export const belgianRateHistory = 'https://bestat.statbel.fgov.be/bestat/crosstable.xhtml?view=772cef7e-f9c5-4f88-b7bd-6b514bed4800';
export const belgianRateBulletin = 'https://petrolprices.economie.fgov.be/petrolprices/?locale=en';

const belgianProducts = new Map([
  ['Euro Super 95 E10', 'be_e10'],
  ['Road Diesel B7', 'be_diesel'],
  ['Heating gasoil (H0/H7) (>=2000L)', 'be_heatingoil']
]);

function belgianText(markup) {
  return markup.replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ').replace(/&(?:gt|#62);/g, '>')
    .replace(/&(?:lt|#60);/g, '<').replace(/(?:&ge;|&#8805;|≥)/g, '>=')
    .replace(/\s+/g, ' ').trim();
}

function belgianTableRows(html) {
  return Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), row =>
    Array.from(row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi), cell => belgianText(cell[1])));
}

function belgianDate(year, month, day, asOf) {
  const date = [year, month, day].map(n => String(n).padStart(2, '0')).join('-');
  const stamp = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date && date <= asOf ? date : null;
}

function belgianRate(value) {
  const number = String(value).match(/^(\d+[.,]\d{1,4})(?:\s*euro\s*\/\s*l)?$/i);
  return number ? Number(number[1].replace(',', '.')) : null;
}

function belgianProduct(label) {
  return belgianProducts.get(label.replace(/\s*\((?:€|&euro;|EUR)\s*\/\s*L\)\s*$/i, ''));
}

export function parseBelgianHistory(html, asOf = new Date().toISOString().slice(0, 10)) {
  const months = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
  const out = {};
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = belgianTableRows(table[1]);
    const header = rows.find(row => row.filter(cell => belgianProduct(cell)).length === belgianProducts.size);
    if (!header || !rows.some(row => row.some(cell => /price incl\. VAT/i.test(cell)))) continue;
    if (rows.some(row => row.some(cell => /price excl\. VAT/i.test(cell)))) continue;
    const firstProduct = header.findIndex(cell => /Euro Super 95 E5/.test(cell));
    if (firstProduct < 0) continue;
    for (const row of rows) {
      const dayIndex = row.findIndex(cell => /^\d{1,2}[A-Z]{3}\d{2}$/.test(cell));
      if (dayIndex < 0) continue;
      if (row.length - dayIndex - 1 !== header.length - firstProduct) continue;
      const [, d, m, y] = row[dayIndex].match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
      const date = belgianDate(2000 + Number(y), months.indexOf(m) + 1, d, asOf);
      if (!date) continue;
      for (let i = firstProduct; i < header.length; i++) {
        const id = belgianProduct(header[i]);
        const value = belgianRate(row[dayIndex + 1 + i - firstProduct]);
        if (id && value !== null) (out[id] ??= []).push({date, value});
      }
    }
  }
  return out;
}

export function parseBelgianBulletin(html, asOf = new Date().toISOString().slice(0, 10)) {
  const stamp = belgianText(html).match(/rate applicable from\s+(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!stamp) return {};
  const date = belgianDate(stamp[3], stamp[2], stamp[1], asOf);
  if (!date) return {};
  const out = {};
  for (const cells of belgianTableRows(html)) {
    const id = cells[0] && belgianProduct(cells[0]);
    if (!id || !/euro\s*\/\s*l/i.test(cells[1] || '')) continue;
    const value = belgianRate(cells[1]);
    if (value !== null) out[id] = [{date, value}];
  }
  return out;
}

export async function getBelgianOilPatch(download, asOf = new Date().toISOString().slice(0, 10)) {
  const documents = await Promise.allSettled([
    download(belgianRateHistory).then(html => parseBelgianHistory(html, asOf)),
    download(belgianRateBulletin).then(html => parseBelgianBulletin(html, asOf))
  ]);
  const merged = {};
  for (const result of documents) {
    if (result.status !== 'fulfilled') continue;
    for (const [id, rows] of Object.entries(result.value)) {
      const byDate = new Map((merged[id] || []).map(row => [row.date, row]));
      for (const row of rows) byDate.set(row.date, row);
      merged[id] = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
  }
  if (!Object.keys(merged).length) throw new Error('No dated Belgian petroleum rates in official tables');
  return merged;
}
