const BASE_URL = "https://sheetdb.io/api/v1/jsrzvylcy75sj";

// ─── 5-minute in-memory cache ─────────────────────────────────────────────────
const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

// ─── Global serial request queue — only 1 SheetDB request in-flight at a time ─
let queue: Array<() => void> = [];
let running = false;

async function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(async () => {
      try { resolve(await task()); }
      catch (e) { reject(e); }
      finally { drain(); }
    });
    if (!running) drain();
  });
}

function drain() {
  const next = queue.shift();
  if (!next) { running = false; return; }
  running = true;
  next();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core fetch with exponential back-off on 429 ──────────────────────────────
async function sheetFetch(url: string, options?: RequestInit): Promise<Response> {
  console.log("Fetching URL:", url);
  const opts = { ...options, headers: { Accept: "application/json", ...options?.headers } };

  let delay = 2000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, opts);
    if (res.status !== 429) return res;
    console.warn(`Rate limited (429) — retrying in ${delay / 1000}s… (attempt ${attempt + 1})`);
    await sleep(delay);
    delay *= 2;
  }
  return fetch(url, opts);
}

// ─── GET a sheet (cached + queued) ────────────────────────────────────────────
export async function fetchSheetData(sheetName: string): Promise<any[]> {
  const cached = getCached(sheetName);
  if (cached) {
    console.log("Data diterima (cache):", sheetName, cached.length, "rows");
    return cached;
  }

  return enqueue(async () => {
    const url = `${BASE_URL}?sheet=${encodeURIComponent(sheetName)}`;
    try {
      const res = await sheetFetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Error Detail:", { sheet: sheetName, status: res.status, body: text });
        if (res.status === 429) throw new Error("SheetDB rate limit tercapai — tunggu 1-2 menit lalu coba lagi.");
        return [];
      }
      const data = await res.json();
      console.log("Data diterima:", sheetName, data);
      if (!Array.isArray(data)) { console.error("Error Detail: bukan array", data); return []; }
      setCache(sheetName, data);
      return data;
    } catch (error) {
      console.error("Error Detail:", { sheet: sheetName, error });
      throw error;
    }
  });
}

// ─── Sequential multi-sheet helper (sheets loaded one-by-one via the queue) ───
export async function fetchMultipleSheets(sheetNames: string[]): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  for (const name of sheetNames) {
    result[name] = await fetchSheetData(name);
  }
  return result;
}

// ─── POST add row ─────────────────────────────────────────────────────────────
export async function addRowToSheet(sheetName: string, row: Record<string, any>): Promise<any> {
  const url = `${BASE_URL}?sheet=${encodeURIComponent(sheetName)}`;
  return enqueue(async () => {
    console.log("Fetching URL:", url, "data:", row);
    try {
      const res = await sheetFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [row] }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Error Detail:", { sheet: sheetName, status: res.status, body: text });
        if (res.status === 429) throw new Error("SheetDB rate limit tercapai — tunggu 1-2 menit lalu coba lagi.");
        throw new Error(`Gagal menambah data ke ${sheetName} (HTTP ${res.status})`);
      }
      const data = await res.json();
      console.log("Data diterima:", sheetName, data);
      invalidateCache(sheetName);
      return data;
    } catch (error) {
      console.error("Error Detail:", { sheet: sheetName, error });
      throw error;
    }
  });
}

// ─── PATCH update row ─────────────────────────────────────────────────────────
export async function updateRowInSheet(
  sheetName: string,
  idField: string,
  idValue: string,
  updates: Record<string, any>
): Promise<any> {
  const url = `${BASE_URL}/${encodeURIComponent(idField)}/${encodeURIComponent(idValue)}?sheet=${encodeURIComponent(sheetName)}`;
  return enqueue(async () => {
    console.log("Fetching URL:", url, "updates:", updates);
    try {
      const res = await sheetFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updates }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Error Detail:", { sheet: sheetName, idField, idValue, status: res.status, body: text });
        if (res.status === 429) throw new Error("SheetDB rate limit tercapai — tunggu 1-2 menit lalu coba lagi.");
        throw new Error(`Gagal mengupdate ${sheetName} (HTTP ${res.status})`);
      }
      const data = await res.json();
      console.log("Data diterima:", sheetName, data);
      invalidateCache(sheetName);
      return data;
    } catch (error) {
      console.error("Error Detail:", { sheet: sheetName, idField, idValue, error });
      throw error;
    }
  });
}

// ─── DELETE row ───────────────────────────────────────────────────────────────
export async function deleteRowFromSheet(
  sheetName: string,
  idField: string,
  idValue: string
): Promise<any> {
  const url = `${BASE_URL}/${encodeURIComponent(idField)}/${encodeURIComponent(idValue)}?sheet=${encodeURIComponent(sheetName)}`;
  return enqueue(async () => {
    console.log("Fetching URL:", url);
    try {
      const res = await sheetFetch(url, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Error Detail:", { sheet: sheetName, idField, idValue, status: res.status, body: text });
        if (res.status === 429) throw new Error("SheetDB rate limit tercapai — tunggu 1-2 menit lalu coba lagi.");
        throw new Error(`Gagal menghapus dari ${sheetName} (HTTP ${res.status})`);
      }
      const data = await res.json();
      console.log("Data diterima:", sheetName, data);
      invalidateCache(sheetName);
      return data;
    } catch (error) {
      console.error("Error Detail:", { sheet: sheetName, idField, idValue, error });
      throw error;
    }
  });
}
