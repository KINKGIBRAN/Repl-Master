export interface DashboardMetrics {
  "Total Mesin": string;
  "Mesin Kosong": string;
  "Stok di Gudang": string;
  "Sisir Rusak": string;
}

export interface MasterStok {
  id: string;
  spesifikasi: string;
  status: "Gudang" | "Dipakai" | "Rusak" | "Di Supplier" | string;
}

export interface LiveTracking {
  id_mesin: string;
  sn: string;
  jenis: string;
  gedung: string;
  id_sisir: string;
  status_mesin: string;
}

export interface HistoryPasang {
  id_log: string;
  id_mesin: string;
  id_sisir: string;
  operator: string;
  tanggal: string;
  catatan: string;
}

export interface HistoryLepas {
  id_log: string;
  id_mesin: string;
  id_sisir: string;
  operator: string;
  tanggal: string;
  kondisi_akhir: string;
  catatan: string;
}

export interface CombinedHistory {
  id_log: string;
  type: 'PASANG' | 'LEPAS';
  id_mesin: string;
  id_sisir: string;
  operator: string;
  tanggal: string;
  catatan: string;
  kondisi_akhir?: string;
}
