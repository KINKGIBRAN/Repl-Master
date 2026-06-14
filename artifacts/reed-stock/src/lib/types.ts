export interface LiveTracking {
  Nomer_Mesin: string;
  Jenis_Mesin: string;
  SN_Mesin: string | number;
  ID_sisir_terpasang: string;
  Nomor_sisir_Destiny: string;
  Tanggal_Pasang: string;
  Durasi_Pakai: string;
}

// ─── Actual column names returned by the GAS endpoint ─────────────────────────
export interface MasterStok {
  "ID SISIR": string;
  "Nomor sisir Destiny": string;
  "Merk Supplier": string;
  "Posisi Rak": string;
  "Status Saat Ini": string;
  "Mesin Terpasang": string;
  "Kondisi Sisir": string;
}

export interface HistoryPasang {
  Tanggal_Ganti: string;
  Nomor_Mesin: string;
  ID_Sisir: string;
  Nomor_sisir_Destiny: string;
  Nama_Mekanik: string;
}

export interface HistoryLepas {
  Tanggal_Lepas: string;
  Nomor_Mesin: string;
  ID_Sisir: string;
  Nomor_sisir_Destiny: string;
  Nama_Mekanik: string;
  Kondisi_SIsir: string;
}

export interface CombinedHistory {
  type: "PASANG" | "LEPAS";
  Nomor_Mesin: string;
  ID_Sisir: string;
  Nomor_sisir_Destiny: string;
  Nama_Mekanik: string;
  tanggal: string;
  Kondisi_SIsir?: string;
}
