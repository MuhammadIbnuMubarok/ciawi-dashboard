import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvDir = path.join(root, "piezometer", "2. CSV CLEAN");
const outputPath = path.join(root, "data", "piezo-arsip.json");
const sourceFiles = [
  "01_STA_0+310_piezometer.csv",
  "02_STA_0+377.5_piezometer.csv",
];
const maxReferenceElevation = 551.367;

function parseCsv(text, fileName) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error(`${fileName}: kutipan CSV tidak ditutup`);
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (!rows.length) throw new Error(`${fileName}: file kosong`);

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) {
    throw new Error(`${fileName}: header kosong atau duplikat`);
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`${fileName}: jumlah kolom baris ${index + 2} tidak konsisten`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });
}

function numberOrNull(value, context) {
  if (value === undefined || value.trim() === "") return null;
  if (value.trim() === "#N/A") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${context}: angka tidak valid (${value})`);
  return number;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function requireDate(value, context) {
  if (!validIsoDate(value)) throw new Error(`${context}: tanggal tidak valid (${value})`);
  return value;
}

const series = {};
const seenReadings = new Set();
const readingsByFile = [];
let readingRows = 0;
let missingElevations = 0;
let naElevationMarkers = 0;
let aboveReference = 0;

for (const fileName of sourceFiles) {
  const rows = parseCsv(fs.readFileSync(path.join(csvDir, fileName), "utf8"), fileName);
  let validReadings = 0;
  let missingInFile = 0;

  for (const row of rows) {
    readingRows += 1;
    const date = requireDate(row.tanggal, `${fileName} (${row.nama_alat})`);
    const instrument = row.nama_alat.trim();
    const station = row.sta.trim();
    if (!instrument || !station) {
      throw new Error(`${fileName}: kode instrumen atau STA kosong pada ${date}`);
    }

    const elevation = numberOrNull(row.elevasi_m, `${fileName} ${instrument} ${date} elevasi_m`);
    if (elevation === null) {
      missingElevations += 1;
      missingInFile += 1;
      if (row.elevasi_m.trim() === "#N/A") naElevationMarkers += 1;
      continue;
    }

    const stationKey = station.replace(/^0\+/, "");
    const key = `${instrument}@${stationKey}@CSV-CLEAN`;
    const identity = `${key}@${date}`;
    if (seenReadings.has(identity)) {
      throw new Error(`Pembacaan duplikat: ${instrument}, STA ${station}, ${date}`);
    }
    seenReadings.add(identity);
    (series[key] ??= []).push([date, elevation]);
    validReadings += 1;
    if (elevation > maxReferenceElevation) aboveReference += 1;
  }
  readingsByFile.push({ fileName, sourceRows: rows.length, validReadings, missingElevations: missingInFile });
}

for (const points of Object.values(series)) {
  points.sort((a, b) => a[0].localeCompare(b[0]));
}

const rainRows = parseCsv(
  fs.readFileSync(path.join(csvDir, "03_DATA_CURAH_HUJAN.csv"), "utf8"),
  "03_DATA_CURAH_HUJAN.csv",
);
const rain = [];
const seenRainDates = new Set();
let missingRain = 0;
for (const row of rainRows) {
  const date = requireDate(row.tanggal, "03_DATA_CURAH_HUJAN.csv");
  if (seenRainDates.has(date)) throw new Error(`Tanggal curah hujan duplikat: ${date}`);
  seenRainDates.add(date);
  const amount = numberOrNull(row.curah_hujan_mm, `03_DATA_CURAH_HUJAN.csv ${date} curah_hujan_mm`);
  if (amount === null) {
    missingRain += 1;
    continue;
  }
  rain.push({ tanggal: date, mm: amount });
}
rain.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

const interpretationRows = parseCsv(
  fs.readFileSync(path.join(csvDir, "05_Interpretasi_Grafik.csv"), "utf8"),
  "05_Interpretasi_Grafik.csv",
);
function interpretationNumber(row, field, rowNumber) {
  return numberOrNull(row[field], `05_Interpretasi_Grafik.csv baris ${rowNumber} ${field}`);
}
const instrumen = interpretationRows.map((row, index) => ({
  kode: row.nama_alat.trim(),
  sta: interpretationNumber(row, "sta", index + 2),
  elevTip: interpretationNumber(row, "elevasi_tip_m", index + 2),
  elevTop: interpretationNumber(row, "elevasi_top_m", index + 2),
  overborden: interpretationNumber(row, "overburden_m", index + 2),
  tekanan: interpretationNumber(row, "tekanan_air_pori_mh2o", index + 2),
  elvTekanan: interpretationNumber(row, "elevasi_tekanan_m", index + 2),
  ru: interpretationNumber(row, "ru", index + 2),
  elevIjin: null,
  ket: row.keterangan.trim(),
  sheet: "Interpretasi Grafik",
}));

const archive = {
  meta: {
    sumber: "piezometer/2. CSV CLEAN (ekspor workbook CLEAN)",
    sheets: [
      "STA 0+310 (CROSS SECTION)",
      "GRAFIK STA0+310 (CROSS SECTION)",
      "STA 0+377.5(CROSS SECTION)",
      "GRAFIK STA0+377,5 (CROSS SECT)",
      "Interpretasi Grafik",
      "DATA CURAH HUJAN",
      "Sheet3",
      "PARAMETER",
      "Data",
      "DI IZINKAN",
      "NILAI REEADING",
      "Sheet2",
      "Jenis alat",
      "Sheet4",
      "GRAFIK STA0+377,5 (CROSS SE (2)",
    ],
    generated: new Date().toISOString(),
    elvTopMainDam: maxReferenceElevation,
  },
  instrumen,
  hujan: rain,
  seri: series,
};

fs.writeFileSync(outputPath, `${JSON.stringify(archive)}\n`, "utf8");
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  readingRows,
  validReadings: seenReadings.size,
  seriesCount: Object.keys(series).length,
  missingElevations,
  naElevationMarkers,
  aboveReference,
  rainSourceRows: rainRows.length,
  validRainDays: rain.length,
  missingRain,
  readingsByFile,
}, null, 2));
