import { supabase } from "./supabaseClient";

// ─── Mapping nama "sheet" lama ke nama tabel Supabase yang sebenarnya ──────
const TABLE_MAP: Record<string, string> = {
  MASTER_STOK: "master_stok",
  LIVE_TRACKING: "live_tracking",
  HISTORY_PASANG: "history_pasang",
  HISTORY_LEPAS: "history_lepas",
};

// ✅ Untuk SELECT, LIVE_TRACKING dibaca dari VIEW v_live_tracking supaya
// kolom durasi_pakai ikut terhitung otomatis (lihat schema: durasi_pakai
// bukan kolom asli, dihitung on-the-fly oleh Postgres).
// Untuk INSERT/UPDATE/DELETE tetap pakai tabel asli live_tracking,
// karena view tidak bisa langsung ditulis.
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

// ─── GET — read all rows (dari view kalau ada, supaya kolom turunan ikut) ──
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

// ─── INSERT — tambah baris baru ke tabel ASLI (bukan view) ─────────────────
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

// ─── UPDATE — update baris di tabel ASLI berdasarkan kolom kunci ──────────
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

// ─── DELETE — hapus baris di tabel ASLI berdasarkan kolom kunci ───────────
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