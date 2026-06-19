// ─── Tipe data sesuai schema Supabase (snake_case) ─────────────────────────
export interface MasterStok {
  id_sisir: string;
  nomor_sisir_destiny?: string;
  merk_supplier?: string;
  posisi_rak?: string;
  status_saat_ini?: string;
  kondisi_sisir?: string;
  mesin_terpasang?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LiveTracking {
  nomer_mesin: string;
  jenis_mesin?: string;
  sn_mesin?: string;
  posisi_gedung?: string;
  id_sisir_terpasang?: string;
  nomor_sisir_destiny?: string;
  tanggal_pasang?: string | null;
  durasi_pakai?: string; // hanya ada kalau baca dari view v_live_tracking
  created_at?: string;
  updated_at?: string;
}

export interface HistoryPasang {
  id?: number;
  tanggal_ganti: string;
  nomor_mesin: string;
  id_sisir: string;
  nomor_sisir_destiny?: string;
  nama_mekanik?: string;
  created_by?: string;
  created_at?: string;
}

export interface HistoryLepas {
  id?: number;
  tanggal_lepas: string;
  nomor_mesin: string;
  id_sisir: string;
  nomor_sisir_destiny?: string;
  nama_mekanik?: string;
  kondisi_sisir?: string;
  created_by?: string;
  created_at?: string;
}

export interface HistoryRiching {
  id?: number;
  id_sisir: string;
  nomor_sisir_destiny?: string;
  nama_operator: string;
  tanggal_kirim: string;
  keterangan?: string;
  created_by?: string;
  created_at?: string;
}

export interface HistoryPotong {
  id?: number;
  id_sisir: string;
  destiny_sebelum: string;
  destiny_sesudah: string;
  nama_mekanik?: string;
  keterangan?: string;
  tanggal_potong: string;
  created_by?: string;
  created_at?: string;
}

export interface CombinedHistory {
  type: "PASANG" | "LEPAS";
  nomor_mesin: string;
  id_sisir: string;
  nomor_sisir_destiny?: string;
  nama_mekanik?: string;
  tanggal: string;
  kondisi_sisir?: string;
  created_by?: string;
  // ─── field tambahan untuk RICHING & POTONG ───
  nama_operator?: string;
  keterangan?: string;
  destiny_sebelum?: string;
  destiny_sesudah?: string;
}
