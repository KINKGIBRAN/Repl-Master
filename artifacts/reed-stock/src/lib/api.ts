// ─── All requests go through our own API server proxy to avoid GAS CORS issues ─
const PROXY_BASE = "/api/gas";

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
  if (sheetName) cache.delete(sheetName);
  else cache.clear();
}

// ─── GET — read all rows from a sheet ────────────────────────────────────────
export async function fetchSheetData(sheetName: string): Promise<any[]> {
  const cached = getCached(sheetName);
  if (cached) {
    console.log("Data diterima (cache):", sheetName, cached.length, "rows");
    return cached;
  }

  const url = `${PROXY_BASE}?sheet=${encodeURIComponent(sheetName)}`;
  console.log("Fetching URL:", url);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Error Detail:", { sheet: sheetName, status: res.status, body: text });
      return [];
    }
    const data = await res.json();
    console.log("Data diterima:", sheetName, data);
    if (!Array.isArray(data)) {
      console.error("Error Detail: response bukan array", data);
      return [];
    }
    setCache(sheetName, data);
    return data;
  } catch (error) {
    console.error("Error Detail:", { sheet: sheetName, error });
    throw new Error(`Gagal mengambil data ${sheetName}: ${(error as Error).message}`);
  }
}

// ─── Parallel multi-sheet fetch (GAS has no per-IP rate limit like SheetDB) ───
export async function fetchMultipleSheets(sheetNames: string[]): Promise<Record<string, any[]>> {
  const entries = await Promise.all(
    sheetNames.map(async (name) => {
      try { return [name, await fetchSheetData(name)] as const; }
      catch { return [name, [] as any[]] as const; }
    })
  );
  return Object.fromEntries(entries);
}

// ─── POST — insert a new row into a sheet ─────────────────────────────────────
export async function addRowToSheet(sheetName: string, row: Record<string, any>): Promise<any> {
  const url = `${PROXY_BASE}?sheet=${encodeURIComponent(sheetName)}&action=insert`;
  console.log("Fetching URL:", url, "data:", row);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Error Detail:", { sheet: sheetName, status: res.status, body: text });
      throw new Error(`Gagal menambah data ke ${sheetName} (HTTP ${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    console.log("Data diterima:", sheetName, data);
    invalidateCache(sheetName);
    return data;
  } catch (error) {
    console.error("Error Detail:", { sheet: sheetName, error });
    throw error;
  }
}

// ─── POST update — update rows matched by a key column ───────────────────────
export async function updateRowInSheet(
  sheetName: string,
  keyColumn: string,
  keyValue: string,
  updates: Record<string, any>
): Promise<any> {
  const url = `${PROXY_BASE}?sheet=${encodeURIComponent(sheetName)}&action=update`;
  console.log("Fetching URL:", url, { keyColumn, keyValue, updates });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyColumn, value: keyValue, data: updates }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Error Detail:", { sheet: sheetName, keyColumn, keyValue, status: res.status, body: text });
      throw new Error(`Gagal mengupdate ${sheetName} (HTTP ${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    console.log("Data diterima:", sheetName, data);
    invalidateCache(sheetName);
    return data;
  } catch (error) {
    console.error("Error Detail:", { sheet: sheetName, keyColumn, keyValue, error });
    throw error;
  }
}

// ─── POST delete — delete rows matched by a key column ───────────────────────
export async function deleteRowFromSheet(
  sheetName: string,
  keyColumn: string,
  keyValue: string
): Promise<any> {
  const url = `${PROXY_BASE}?sheet=${encodeURIComponent(sheetName)}&action=delete`;
  console.log("Fetching URL:", url, { keyColumn, keyValue });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyColumn, value: keyValue }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Error Detail:", { sheet: sheetName, keyColumn, keyValue, status: res.status, body: text });
      throw new Error(`Gagal menghapus dari ${sheetName} (HTTP ${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    console.log("Data diterima:", sheetName, data);
    invalidateCache(sheetName);
    return data;
  } catch (error) {
    console.error("Error Detail:", { sheet: sheetName, keyColumn, keyValue, error });
    throw error;
  }
}
