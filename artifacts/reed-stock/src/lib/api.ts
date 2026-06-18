import { supabase } from "./supabaseClient";

// ─── Mapping nama "sheet" lama ke nama tabel Supabase yang sebenarnya ──────
const TABLE_MAP: Record<string, string> = {
  MASTER_STOK: "master_stok",
  LIVE_TRACKING: "live_tracking",
  HISTORY_PASANG: "history_pasang",
  HISTORY_LEPAS: "history_lepas",
};

const READ_TABLE_MAP: Record<string, string> = {
  ...TABLE_MAP,
  LIVE_TRACKING: "v_live_tracking",
};

function resolveTable(name: string): string {
  return TABLE_MAP[name] ?? name.toLowerCase();
}

function resolveReadTable(name: string): string {
  return READ_TABLE_MAP[name] ?? name.toLowerCase();
}

// ─── Simple in-memory cache (2-minute TTL) ────────────────────────────────────
const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCached(key: string): any[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: any[]) {
  cache.set(key, { data, ts: Date.now() });
}
export function invalidateCache(sheetName?: string) {
  if (sheetName) cache.delete(resolveReadTable(sheetName));
  else cache.clear();
}

// ─── Normalisasi nomor_sisir_destiny ─────────────────────────────────────────
// Contoh: "32x78x115" / "32 x 78 x 115" / "32X78X115" → selalu "32X78X115"
function normalizeDestiny(val: string): string {
  return val
    .trim()
    .replace(/\s+/g, "")   // hapus semua spasi
    .toUpperCase();          // ubah x → X, huruf kecil lain → kapital
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function fetchSheetData(sheetName: string): Promise<any[]> {
  const readTable = resolveReadTable(sheetName);

  const cached = getCached(readTable);
  if (cached) {
    console.log("Data diterima (cache):", readTable, cached.length, "rows");
    return cached;
  }

  const { data, error } = await supabase.from(readTable).select("*");

  if (error) {
    console.error("Error Detail:", { readTable, error });
    throw new Error(`Gagal mengambil data ${readTable}: ${error.message}`);
  }

  console.log("Data diterima:", readTable, data?.length ?? 0, "rows");
  setCache(readTable, data ?? []);
  return data ?? [];
}

// ─── Parallel multi-table fetch ───────────────────────────────────────────────
export async function fetchMultipleSheets(sheetNames: string[]): Promise<Record<string, any[]>> {
  const entries = await Promise.all(
    sheetNames.map(async (name) => {
      try { return [name, await fetchSheetData(name)] as const; }
      catch { return [name, [] as any[]] as const; }
    })
  );
  return Object.fromEntries(entries);
}

// ─── INSERT ───────────────────────────────────────────────────────────────────
export async function addRowToSheet(sheetName: string, row: Record<string, any>): Promise<any> {
  const table = resolveTable(sheetName);
  console.log("Insert ke:", table, "data:", row);

  const { data, error } = await supabase.from(table).insert(row).select();

  if (error) {
    console.error("Error Detail:", { table, error });
    throw new Error(`Gagal menambah data ke ${table}: ${error.message}`);
  }

  console.log("Data diterima:", table, data);
  invalidateCache(sheetName);
  return data;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateRowInSheet(
  sheetName: string,
  keyColumn: string,
  keyValue: string,
  updates: Record<string, any>
): Promise<any> {
  const table = resolveTable(sheetName);
  console.log("Update di:", table, { keyColumn, keyValue, updates });

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq(keyColumn, keyValue)
    .select();

  if (error) {
    console.error("Error Detail:", { table, keyColumn, keyValue, error });
    throw new Error(`Gagal mengupdate ${table}: ${error.message}`);
  }

  console.log("Data diterima:", table, data);
  invalidateCache(sheetName);
  return data;
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteRowFromSheet(
  sheetName: string,
  keyColumn: string,
  keyValue: string
): Promise<any> {
  const table = resolveTable(sheetName);
  console.log("Delete di:", table, { keyColumn, keyValue });

  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq(keyColumn, keyValue)
    .select();

  if (error) {
    console.error("Error Detail:", { table, keyColumn, keyValue, error });
    throw new Error(`Gagal menghapus dari ${table}: ${error.message}`);
  }

  console.log("Data diterima:", table, data);
  invalidateCache(sheetName);
  return data;
}

// ─── EXPORT TEMPLATE ─────────────────────────────────────────────────────────
export async function exportTemplateCSV(): Promise<string> {
  const headers = [
    "id_sisir",
    "nomor_sisir_destiny",
    "merk_supplier",
    "posisi_rak",
    "status_saat_ini",
    "kondisi_sisir",
  ];

  const exampleRows = [
    ["SKR-001", "32X78X100", "SETIA KIJI REED", "RAK A1", "GUDANG", "BAGUS"],
    ["SKR-002", "32X78X115", "SETIA KIJI REED", "RAK A2", "GUDANG", "BAGUS"],
    ["SKR-003", "40X90X120", "SUPPLIER XYZ", "RAK B1", "GUDANG", "BAGUS"],
  ];

  const csvContent = [
    headers.join(","),
    ...exampleRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ...Array(5)
      .fill(null)
      .map(() => headers.map(() => '""').join(",")),
  ].join("\n");

  return csvContent;
}

// ─── IMPORT BULK ──────────────────────────────────────────────────────────────
export async function importBulkFromFile(
  csvContent: string
): Promise<{ success: number; failed: number; errors: Array<{ row: number; error: string }> }> {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("File harus memiliki minimal header dan 1 baris data");
  }

  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.replace(/"/g, "").trim());

  const validHeaders = [
    "id_sisir",
    "nomor_sisir_destiny",
    "merk_supplier",
    "posisi_rak",
    "status_saat_ini",
    "kondisi_sisir",
  ];

  const missingHeaders = validHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Header tidak lengkap. Kolom yang kurang: ${missingHeaders.join(", ")}`);
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line
      .split(",")
      .map((cell) => cell.replace(/"/g, "").trim());

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] || "";
    });

    if (!row.id_sisir || row.id_sisir.trim() === "") {
      continue;
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Tidak ada data valid untuk diimport");
  }

  const { data: existingData, error: fetchError } = await supabase
    .from("master_stok")
    .select("id_sisir");

  if (fetchError) {
    throw new Error(`Gagal mengecek data existing: ${fetchError.message}`);
  }

  const existingIds = new Set((existingData ?? []).map((d) => d.id_sisir?.trim().toUpperCase()));

  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dataRowNumber = i + 2;

    try {
      const idTrim = row.id_sisir.trim().toUpperCase();

      if (existingIds.has(idTrim)) {
        results.failed++;
        results.errors.push({
          row: dataRowNumber,
          error: `ID "${row.id_sisir}" sudah ada di database`,
        });
        continue;
      }

      const insertData = {
        id_sisir: idTrim,
        // ✅ Normalisasi: "32x78x115" / "32 X 78 X 115" → "32X78X115"
        nomor_sisir_destiny: normalizeDestiny(row.nomor_sisir_destiny || ""),
        merk_supplier: row.merk_supplier?.trim() || "",
        posisi_rak: row.posisi_rak?.trim() || "",
        status_saat_ini: row.status_saat_ini?.trim() || "GUDANG",
        kondisi_sisir: row.kondisi_sisir?.trim() || "BAGUS",
      };

      const { error: insertError } = await supabase
        .from("master_stok")
        .insert(insertData);

      if (insertError) {
        results.failed++;
        results.errors.push({
          row: dataRowNumber,
          error: insertError.message,
        });
      } else {
        results.success++;
        existingIds.add(idTrim);
      }
    } catch (err: any) {
      results.failed++;
      results.errors.push({
        row: dataRowNumber,
        error: err.message || "Gagal insert data",
      });
    }
  }

  invalidateCache("MASTER_STOK");
  return results;
}