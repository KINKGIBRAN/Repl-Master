import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet, exportTemplateCSV, importBulkFromFile, deleteRowFromSheet } from "@/lib/api";
import { MasterStok, HistoryPasang, HistoryLepas, HistoryPotong, HistoryRiching, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Settings, Scissors, AlertCircle, Search, Lock, Wrench, PackageCheck, Download, Upload, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReedHistoryPDF, generateStokRekapPDF, generateSisirRusakPDF } from "@/lib/pdf";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

const formatDate = (str: string): string => {
  if (!str || str === "-") return "-";
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return str;
  }
};

const getEffectiveStatus = (item: MasterStok): string => {
  const status = (item.status_saat_ini || "").trim().toUpperCase();
  if (status.includes("DIPAKAI") || status.includes("PAKAI")) return "Dipakai";
  if (status.includes("SERVICE") || status.includes("REPAIR")) return "Service";
  if (status.includes("RUSAK")) return "Rusak";
  if (status.includes("RICHING")) return "Riching";
  if (status.includes("GUDANG")) return "Gudang";
  const kondisi = (item.kondisi_sisir || "").trim().toUpperCase();
  if (kondisi.includes("RUSAK")) return "Rusak";
  return status || "-";
};

// ─── Helper: parse "DxPxT" → { destiny, panjang, tinggi } ──────────────────
function parseDestiny(val: string): { destiny: string; panjang: string; tinggi: string } {
  const parts = (val || "").toUpperCase().split("X");
  return {
    destiny: parts[0]?.trim() || "",
    panjang: parts[1]?.trim() || "",
    tinggi: parts[2]?.trim() || "",
  };
}

// ─── Helper: gabungkan 3 bagian → "DxPxT" uppercase ────────────────────────
function buildDestiny(destiny: string, panjang: string, tinggi: string): string {
  return [destiny, panjang, tinggi]
    .map((s) => s.trim().toUpperCase())
    .join("X");
}

type FilterKey = "Semua" | "Gudang" | "Riching" | "Dipakai" | "Rusak" | "Service";

export default function StokPage() {
  const { isAdmin, currentUser } = useAuth();
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedReed, setSelectedReed] = useState<MasterStok | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBuangOpen, setIsBuangOpen] = useState(false);

  // ─── State Tambah Sisir ───────────────────────────────────────────────────
  const [newReed, setNewReed] = useState({
    id_sisir: "",
    destiny: "",
    panjang: "",
    tinggi: "",
    merk_supplier: "",
    posisi_rak: "",
  });

  // ─── State Potong Sisir ───────────────────────────────────────────────────
  const [cutData, setCutData] = useState({
    panjang: "",
    mekanik: "",
    keterangan: "",
  });

  // ─── State Import ─────────────────────────────────────────────────────────
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // ─── State Kirim Riching ──────────────────────────────────────────────────
  const [isRichingOpen, setIsRichingOpen] = useState(false);
  const [richingData, setRichingData] = useState({
    nama_operator: "",
    keterangan: "",
  });

  const selectedReedRef = useRef<MasterStok | null>(null);
  selectedReedRef.current = selectedReed;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets([
        "MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS", "HISTORY_POTONG", "HISTORY_RICHING",
      ]);
      const stokData: MasterStok[]     = (sheets["MASTER_STOK"]  || []).filter(
        (s: MasterStok) => s.id_sisir && s.id_sisir.trim() !== ""
      );
      const hpData: HistoryPasang[]    = sheets["HISTORY_PASANG"]  || [];
      const hlData: HistoryLepas[]     = sheets["HISTORY_LEPAS"]   || [];
      const hpotData: HistoryPotong[]  = sheets["HISTORY_POTONG"]  || [];
      const hrData: HistoryRiching[]   = sheets["HISTORY_RICHING"] || [];

      setStok(stokData);

      const combined: CombinedHistory[] = [
        ...hpData.map((h) => ({
          type: "PASANG" as const,
          nomor_mesin: h.nomor_mesin,
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_ganti,
        })),
        ...hlData.map((h) => ({
          type: "LEPAS" as const,
          nomor_mesin: h.nomor_mesin,
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_lepas,
          kondisi_sisir: h.kondisi_sisir,
        })),
        ...hpotData.map((h) => ({
          type: "POTONG" as any,
          nomor_mesin: "-",
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.destiny_sesudah,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_potong,
          keterangan: h.keterangan,
          destiny_sebelum: h.destiny_sebelum,
          destiny_sesudah: h.destiny_sesudah,
        })),
        ...hrData.map((h) => ({
          type: "RICHING" as any,
          nomor_mesin: "-",
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_operator,
          tanggal: h.tanggal_kirim,
          keterangan: h.keterangan,
        })),
      ];
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);

      const current = selectedReedRef.current;
      if (current) {
        const updated = stokData.find((s) => s.id_sisir === current.id_sisir);
        if (updated) setSelectedReed(updated);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat stok");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Tambah Sisir Baru ────────────────────────────────────────────────────
  const handleAddReed = async () => {
    const idTrim = newReed.id_sisir.trim();
    if (!idTrim) {
      toast.error("ID Sisir harus diisi");
      return;
    }
    if (!newReed.destiny || !newReed.panjang || !newReed.tinggi) {
      toast.error("Nomor Sisir Destiny harus diisi lengkap (Destiny × Panjang × Tinggi)");
      return;
    }
    const isDuplicate = stok.some(
      (s) => s.id_sisir.trim().toUpperCase() === idTrim.toUpperCase()
    );
    if (isDuplicate) {
      toast.error(`ID Sisir "${idTrim}" sudah terdaftar. Gunakan ID lain.`);
      return;
    }
    setActionLoading(true);
    try {
      await addRowToSheet("MASTER_STOK", {
        id_sisir: idTrim,
        nomor_sisir_destiny: buildDestiny(newReed.destiny, newReed.panjang, newReed.tinggi),
        merk_supplier: newReed.merk_supplier,
        posisi_rak: newReed.posisi_rak,
        status_saat_ini: "GUDANG",
        kondisi_sisir: "BAGUS",
      });
      toast.success("Sisir berhasil ditambahkan");
      setNewReed({ id_sisir: "", destiny: "", panjang: "", tinggi: "", merk_supplier: "", posisi_rak: "" });
      setIsAddOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah sisir");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Kirim Service ────────────────────────────────────────────────────────
  const handleKirimService = async () => {
    if (!selectedReed) return;
    const id = selectedReed.id_sisir;
    const tanggal = new Date().toISOString();
    const supplier = selectedReed.merk_supplier || "Supplier";

    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", id, {
        status_saat_ini: "SERVICE",
        kondisi_sisir: "SERVICE",
      });

      await addRowToSheet("HISTORY_LEPAS", {
        tanggal_lepas: tanggal,
        nomor_mesin: `Dikirim ke ${supplier}`,
        id_sisir: id,
        nomor_sisir_destiny: selectedReed.nomor_sisir_destiny || "",
        nama_mekanik: "-",
        kondisi_sisir: "KIRIM_SERVICE",
        created_by: currentUser?.nama || "-",
      });

      toast.success("Sisir berhasil dikirim ke service");
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim data service");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Terima Service ───────────────────────────────────────────────────────
  const handleTerimaService = async () => {
    if (!selectedReed) return;
    const idSisir = selectedReed.id_sisir;
    const nomorDestiny = selectedReed.nomor_sisir_destiny || "";
    const tanggalSekarang = new Date().toISOString();
    const supplier = selectedReed.merk_supplier || "Supplier";

    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", idSisir, {
        status_saat_ini: "GUDANG",
        kondisi_sisir: "BAGUS",
        mesin_terpasang: "",
      });

      await addRowToSheet("HISTORY_LEPAS", {
        tanggal_lepas: tanggalSekarang,
        nomor_mesin: `Diterima dari ${supplier}`,
        id_sisir: idSisir,
        nomor_sisir_destiny: nomorDestiny,
        nama_mekanik: currentUser?.nama || "-",
        kondisi_sisir: "BAIK",
        created_by: currentUser?.nama || "-",
      });

      toast.success("Sisir berhasil diterima dari service");
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status sisir");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Kirim Riching ────────────────────────────────────────────────────────
  const handleKirimRiching = async () => {
    if (!selectedReed) return;
    if (!richingData.nama_operator.trim()) {
      toast.error("Nama operator harus diisi");
      return;
    }

    const tanggal = new Date().toISOString();
    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", selectedReed.id_sisir, {
        status_saat_ini: "RICHING",
        kondisi_sisir: "RICHING",
      });

      await addRowToSheet("HISTORY_RICHING", {
        id_sisir: selectedReed.id_sisir,
        nomor_sisir_destiny: selectedReed.nomor_sisir_destiny || "",
        nama_operator: richingData.nama_operator.trim(),
        tanggal_kirim: tanggal,
        keterangan: richingData.keterangan.trim(),
        created_by: currentUser?.nama || "-",
      });

      toast.success("Sisir berhasil dikirim ke proses riching");
      setRichingData({ nama_operator: "", keterangan: "" });
      setIsRichingOpen(false);
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim sisir ke riching");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Batal Riching — kembalikan ke Gudang ─────────────────────────────────
  const handleBatalRiching = async () => {
    if (!selectedReed) return;
    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", selectedReed.id_sisir, {
        status_saat_ini: "GUDANG",
        kondisi_sisir: "BAGUS",
      });

      toast.success("Sisir dikembalikan ke gudang");
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengembalikan sisir ke gudang");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Buang Sisir (hapus permanen) — hanya dari status RUSAK ──────────────
  const handleBuang = async () => {
    if (!selectedReed) return;
    setActionLoading(true);
    try {
      await deleteRowFromSheet("MASTER_STOK", "id_sisir", selectedReed.id_sisir);
      toast.success(`Sisir ${selectedReed.id_sisir} berhasil dihapus dari sistem`);
      setIsBuangOpen(false);
      setIsDetailOpen(false);
      setSelectedReed(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus sisir");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Potong Sisir ─────────────────────────────────────────────────────────
  const handlePotong = async () => {
    if (!selectedReed || !cutData.panjang.trim()) {
      toast.error("Isi panjang baru");
      return;
    }
    const { destiny, panjang: panjangSaatIni, tinggi } = parseDestiny(selectedReed.nomor_sisir_destiny || "");

    // ── Validasi: panjang baru harus lebih kecil dari panjang saat ini ──
    const panjangBaru    = parseInt(cutData.panjang, 10);
    const panjangCurrent = parseInt(panjangSaatIni, 10);
    if (isNaN(panjangBaru) || panjangBaru <= 0) {
      toast.error("Panjang baru tidak valid");
      return;
    }
    if (panjangBaru >= panjangCurrent) {
      toast.error(
        `Panjang baru (${panjangBaru}) harus lebih kecil dari panjang saat ini (${panjangCurrent})`
      );
      return;
    }

    const destinySebelum = selectedReed.nomor_sisir_destiny || "";
    const destinySesudah = buildDestiny(destiny, cutData.panjang, tinggi);

    setActionLoading(true);
    try {
      // Update dimensi di master_stok
      await updateRowInSheet("MASTER_STOK", "id_sisir", selectedReed.id_sisir, {
        nomor_sisir_destiny: destinySesudah,
        kondisi_sisir: `Dipotong ${new Date().toLocaleDateString("id-ID")}${cutData.mekanik ? " oleh " + cutData.mekanik : ""}`,
      });

      // Catat ke history_potong
      await addRowToSheet("HISTORY_POTONG", {
        id_sisir: selectedReed.id_sisir,
        destiny_sebelum: destinySebelum,
        destiny_sesudah: destinySesudah,
        nama_mekanik: cutData.mekanik.trim() || "-",
        keterangan: cutData.keterangan.trim(),
        tanggal_potong: new Date().toISOString(),
        created_by: currentUser?.nama || "-",
      });

      toast.success("Spesifikasi berhasil diupdate");
      setCutData({ panjang: "", mekanik: "", keterangan: "" });
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal update data potong");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Download Template CSV ────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    try {
      const csvContent = exportTemplateCSV();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Template_Stok_Sisir_${new Date().getTime()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Template berhasil diunduh");
    } catch (err: any) {
      toast.error(err.message || "Gagal mendownload template");
    }
  };

  // ─── Handle File Upload ───────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("Hanya file .csv yang didukung");
        setImportFile(null);
        return;
      }
      setImportFile(file);
      setImportResults(null);
    }
  };

  // ─── Import Bulk dari File ────────────────────────────────────────────────
  const handleImportFile = async () => {
    if (!importFile) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }

    setImportLoading(true);
    try {
      const csvContent = await importFile.text();
      const results = await importBulkFromFile(csvContent);
      setImportResults(results);

      if (results.failed === 0) {
        toast.success(`${results.success} sisir berhasil diimport!`);
        setImportFile(null);
        setTimeout(() => {
          setIsImportOpen(false);
          loadData();
        }, 1500);
      } else if (results.success > 0) {
        toast.warning(`${results.success} berhasil, ${results.failed} gagal. Lihat detail di bawah.`);
      } else {
        toast.error(`Semua data gagal diimport. Lihat detail di bawah.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengimport file");
      setImportResults(null);
    } finally {
      setImportLoading(false);
    }
  };

  // ─── Counts & Filter ──────────────────────────────────────────────────────
  const searchFilteredStok = (() => {
    let list = stok;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.id_sisir?.toLowerCase().includes(q) ||
          s.nomor_sisir_destiny?.toLowerCase().includes(q) ||
          s.merk_supplier?.toLowerCase().includes(q) ||
          s.posisi_rak?.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  const counts: Record<FilterKey, number> = {
    Semua:   searchFilteredStok.length,
    Gudang:  searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Gudang").length,
    Riching: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Riching").length,
    Dipakai: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Dipakai").length,
    Rusak:   searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Rusak").length,
    Service: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Service").length,
  };

  const filteredStok = (() => {
    return filter === "Semua"
      ? searchFilteredStok
      : searchFilteredStok.filter((s) => getEffectiveStatus(s) === filter);
  })();

  const reedHistory = historyData.filter((h) => h.id_sisir === selectedReed?.id_sisir);

  const statusBadge = (item: MasterStok) => {
    const label = getEffectiveStatus(item);
    const styles: Record<string, string> = {
      Gudang:  "bg-blue-500/20 text-blue-400 border-blue-500/40",
      Riching: "bg-purple-500/20 text-purple-400 border-purple-500/40",
      Dipakai: "bg-primary/20 text-primary border-primary/40",
      Rusak:   "bg-destructive/20 text-destructive border-destructive/40",
      Service: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    };
    return (
      <Badge variant="outline" className={styles[label] ?? "bg-muted text-muted-foreground border-border"}>
        {label}
      </Badge>
    );
  };

  const selectedStatus = selectedReed ? getEffectiveStatus(selectedReed) : "";
  const isLocked   = selectedStatus === "Dipakai";
  const isRusak    = selectedStatus === "Rusak";
  const isService  = selectedStatus === "Service";
  const isRiching  = selectedStatus === "Riching";

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
        <Button onClick={loadData} className="w-full">Coba Lagi</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">

      {/* ── Header ── */}
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Master Stok Sisir</h1>

        <div className="flex items-center gap-2">
          {/* Export PDF Rekap */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              generateStokRekapPDF(
                searchFilteredStok,
                getEffectiveStatus,
                currentUser?.nama || "___________________"
              )
            }
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Export
          </Button>

          {/* Export PDF Sisir Rusak — untuk approval buang/scrap, hanya Admin */}
          {isAdmin && counts.Rusak > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() =>
                generateSisirRusakPDF(
                  stok.filter((s) => getEffectiveStatus(s) === "Rusak"),
                  currentUser?.nama || "___________________"
                )
              }
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Rusak ({counts.Rusak})
            </Button>
          )}

          {/* Import — hanya Admin */}
          {isAdmin && (
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Import Stok Sisir dari CSV</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleDownloadTemplate}
                    disabled={importLoading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template CSV
                  </Button>

                  <div
                    className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById("csv-input")?.click()}
                  >
                    <input
                      id="csv-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {importFile ? importFile.name : "Klik untuk pilih file CSV"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      atau drag & drop file di sini
                    </p>
                  </div>

                  {importResults && (
                    <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        {importResults.success > 0 && (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span><strong>{importResults.success}</strong> berhasil</span>
                          </>
                        )}
                      </div>
                      {importResults.failed > 0 && (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span><strong>{importResults.failed}</strong> gagal</span>
                          </div>
                          {importResults.errors.length > 0 && (
                            <details className="text-xs">
                              <summary className="font-semibold cursor-pointer">
                                Lihat detail error
                              </summary>
                              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                                {importResults.errors.slice(0, 10).map((err, idx) => (
                                  <div
                                    key={idx}
                                    className="text-destructive/70 bg-destructive/5 p-1.5 rounded text-xs"
                                  >
                                    <strong>Baris {err.row}:</strong> {err.error}
                                  </div>
                                ))}
                                {importResults.errors.length > 10 && (
                                  <p className="text-muted-foreground text-xs italic">
                                    ... dan {importResults.errors.length - 10} error lainnya
                                  </p>
                                )}
                              </div>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    onClick={handleImportFile}
                    disabled={!importFile || importLoading}
                    className="w-full"
                  >
                    {importLoading ? "Mengimport..." : "Mulai Import"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Tambah — hanya Admin */}
          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Tambah Sisir Baru</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>ID Sisir</Label>
                    <Input
                      value={newReed.id_sisir}
                      onChange={(e) => setNewReed({ ...newReed, id_sisir: e.target.value })}
                      placeholder="Contoh: SKR-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nomor Sisir Destiny</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        className="w-20 text-center"
                        value={newReed.destiny}
                        onChange={(e) => setNewReed({ ...newReed, destiny: e.target.value.replace(/\D/g, "") })}
                        placeholder="32"
                        maxLength={4}
                      />
                      <span className="font-bold text-muted-foreground select-none">X</span>
                      <Input
                        className="w-20 text-center"
                        value={newReed.panjang}
                        onChange={(e) => setNewReed({ ...newReed, panjang: e.target.value.replace(/\D/g, "") })}
                        placeholder="78"
                        maxLength={4}
                      />
                      <span className="font-bold text-muted-foreground select-none">X</span>
                      <Input
                        className="w-20 text-center"
                        value={newReed.tinggi}
                        onChange={(e) => setNewReed({ ...newReed, tinggi: e.target.value.replace(/\D/g, "") })}
                        placeholder="115"
                        maxLength={4}
                      />
                    </div>
                    {(newReed.destiny || newReed.panjang || newReed.tinggi) && (
                      <p className="text-xs text-muted-foreground">
                        Tersimpan sebagai:{" "}
                        <span className="font-mono font-semibold text-primary">
                          {buildDestiny(newReed.destiny || "?", newReed.panjang || "?", newReed.tinggi || "?")}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Merk Supplier</Label>
                    <Input
                      value={newReed.merk_supplier}
                      onChange={(e) => setNewReed({ ...newReed, merk_supplier: e.target.value })}
                      placeholder="Contoh: SETIA KIJI REED"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posisi Rak</Label>
                    <Input
                      value={newReed.posisi_rak}
                      onChange={(e) => setNewReed({ ...newReed, posisi_rak: e.target.value })}
                      placeholder="Contoh: RAK A1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddReed} disabled={actionLoading}>
                    {actionLoading ? "Menyimpan..." : "Simpan"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          type="text"
          placeholder="Cari ID, nomor destiny, merk, atau rak..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-10 rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Filter Tabs — 6 kolom ── */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="w-full grid grid-cols-6 h-auto">
          {(["Semua", "Gudang", "Riching", "Dipakai", "Rusak", "Service"] as FilterKey[]).map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex-col gap-0 py-1.5 text-xs">
              <span>{tab}</span>
              <span className="text-[10px] font-bold text-primary">{counts[tab]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── List ── */}
      {filteredStok.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          {searchQuery ? "Tidak ditemukan." : "Tidak ada data untuk filter ini."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredStok.map((item) => {
            const disp = getEffectiveStatus(item);
            const locked = disp === "Dipakai";
            const riching = disp === "Riching";
            return (
              <div
                key={item.id_sisir}
                onClick={() => { setSelectedReed(item); setIsDetailOpen(true); }}
                className={`bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between ${locked ? "opacity-80" : ""} ${riching ? "border-purple-500/30" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-bold font-mono flex items-center gap-2">
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {riching && <Wrench className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
                    {item.id_sisir}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {item.nomor_sisir_destiny} · {item.merk_supplier}
                  </div>
                  {item.posisi_rak && (
                    <div className="text-xs text-muted-foreground/60">{item.posisi_rak}</div>
                  )}
                </div>
                {statusBadge(item)}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail Dialog ── */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => {
        if (!actionLoading) setIsDetailOpen(open);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedReed && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start pr-6">
                  <DialogTitle className="font-mono">{selectedReed.id_sisir}</DialogTitle>
                  {statusBadge(selectedReed)}
                </div>
              </DialogHeader>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Nomor Destiny</p>
                  <p className="font-medium">{selectedReed.nomor_sisir_destiny || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Merk Supplier</p>
                  <p className="font-medium">{selectedReed.merk_supplier || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mesin Terpasang</p>
                  <p className="font-medium">{selectedReed.mesin_terpasang || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Posisi Rak</p>
                  <p className="font-medium">{selectedReed.posisi_rak || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Kondisi</p>
                  <p className="font-medium">{selectedReed.kondisi_sisir || "-"}</p>
                </div>
              </div>

              {/* Warning: Dipakai */}
              {isLocked && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  Sisir sedang terpasang di mesin <strong>{selectedReed.mesin_terpasang}</strong>.
                  Lepas dari mesin terlebih dahulu sebelum mengubah status.
                </div>
              )}

              {/* Warning: Rusak */}
              {isRusak && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Sisir berstatus <strong>RUSAK</strong>. Kirim ke supplier untuk di-service, atau buang jika sudah tidak bisa digunakan.
                </div>
              )}

              {/* Aksi Buang — Admin only, hanya saat RUSAK */}
              {isAdmin && isRusak && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                        onClick={handleKirimService}
                        disabled={actionLoading}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Kirim Service"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => setIsBuangOpen(true)}
                        disabled={actionLoading}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Buang / Scrap
                      </Button>
                    </div>
                  </div>

                  {/* Dialog Konfirmasi Buang */}
                  <Dialog open={isBuangOpen} onOpenChange={setIsBuangOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                          <Trash2 className="w-5 h-5" /> Konfirmasi Buang Sisir
                        </DialogTitle>
                        <DialogDescription className="pt-2 space-y-2">
                          <span className="block">
                            Anda akan menghapus sisir{" "}
                            <strong className="font-mono text-foreground">{selectedReed.id_sisir}</strong>{" "}
                            ({selectedReed.nomor_sisir_destiny}) secara <strong>permanen</strong> dari sistem.
                          </span>
                          <span className="block text-destructive font-medium">
                            ⚠ Data tidak dapat dikembalikan setelah dihapus.
                          </span>
                          <span className="block">
                            Pastikan dokumen approval fisik sudah ditandatangani sebelum melanjutkan.
                          </span>
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 mt-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsBuangOpen(false)}
                          disabled={actionLoading}
                        >
                          Batal
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleBuang}
                          disabled={actionLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {actionLoading ? "Menghapus..." : "Ya, Buang Permanen"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {/* Warning: Service */}
              {isService && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Sisir sedang dalam proses <strong>SERVICE</strong>. Klik "Terima Service" setelah diterima kembali dari supplier.
                </div>
              )}

              {/* Warning: Riching */}
              {isRiching && (
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/30 px-3 py-2 text-xs text-purple-600">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  Sisir sedang dalam proses <strong>RICHING</strong>. Bisa langsung dipasang ke mesin atau dibatalkan kembali ke gudang.
                </div>
              )}

              {/* Aksi — Admin only, tidak locked */}
              {isAdmin && !isLocked && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                  <div className="flex gap-2 flex-wrap">

                    {/* ── Kirim Riching — hanya dari GUDANG ── */}
                    {!isRusak && !isService && !isRiching && (
                      <Dialog open={isRichingOpen} onOpenChange={(open) => {
                        setIsRichingOpen(open);
                        if (open) setRichingData({ nama_operator: "", keterangan: "" });
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="flex-1 border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
                            disabled={actionLoading}
                          >
                            <Wrench className="w-4 h-4 mr-2" />
                            Kirim Riching
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Kirim Riching — {selectedReed.id_sisir}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Nama Operator Riching</Label>
                              <Input
                                value={richingData.nama_operator}
                                onChange={(e) => setRichingData({ ...richingData, nama_operator: e.target.value })}
                                placeholder="Nama Operator"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Keterangan{" "}
                                <span className="text-muted-foreground text-xs">(opsional)</span>
                              </Label>
                              <Input
                                value={richingData.keterangan}
                                onChange={(e) => setRichingData({ ...richingData, keterangan: e.target.value })}
                                placeholder="Contoh: untuk plan ganti proses M-05"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleKirimRiching} disabled={actionLoading}>
                              {actionLoading ? "Memproses..." : "Konfirmasi Kirim"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* ── Batal Riching — kembalikan ke Gudang ── */}
                    {isRiching && (
                      <Button
                        variant="outline"
                        className="flex-1 border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
                        onClick={handleBatalRiching}
                        disabled={actionLoading}
                      >
                        <PackageCheck className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Batal Riching"}
                      </Button>
                    )}

                    {/* ── Kirim Service — dari GUDANG atau RICHING (bukan dari RUSAK, sudah ada di atas) ── */}
                    {!isService && !isRusak && (
                      <Button
                        variant="outline"
                        className="flex-1 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                        onClick={handleKirimService}
                        disabled={actionLoading}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Kirim Service"}
                      </Button>
                    )}

                    {/* ── Terima Service ── */}
                    {isService && (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleTerimaService}
                        disabled={actionLoading}
                      >
                        <PackageCheck className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Terima Service"}
                      </Button>
                    )}

                    {/* ── Potong — hanya GUDANG (bukan Riching/Rusak/Service) ── */}
                    {!isRusak && !isService && !isRiching && (() => {
                      const { destiny, panjang, tinggi } = parseDestiny(selectedReed.nomor_sisir_destiny || "");
                      return (
                        <Dialog onOpenChange={(open) => {
                          if (open) setCutData({ panjang: "", mekanik: "", keterangan: "" });
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1" disabled={actionLoading}>
                              <Scissors className="w-4 h-4 mr-2" /> Potong
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Potong Sisir {selectedReed.id_sisir}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Dimensi Baru (Destiny × Panjang × Tinggi)</Label>
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    className="w-20 text-center bg-muted/50 cursor-not-allowed"
                                    value={destiny}
                                    readOnly
                                    disabled
                                    title="Destiny tidak bisa diubah saat potong"
                                  />
                                  <span className="font-bold text-muted-foreground select-none">X</span>
                                  <Input
                                    className="w-20 text-center"
                                    value={cutData.panjang}
                                    onChange={(e) =>
                                      setCutData({ ...cutData, panjang: e.target.value.replace(/\D/g, "") })
                                    }
                                    placeholder={panjang || "78"}
                                    maxLength={4}
                                    autoFocus
                                  />
                                  <span className="font-bold text-muted-foreground select-none">X</span>
                                  <Input
                                    className="w-20 text-center bg-muted/50 cursor-not-allowed"
                                    value={tinggi}
                                    readOnly
                                    disabled
                                    title="Tinggi tidak bisa diubah saat potong"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Destiny dan tinggi dikunci. Panjang saat ini:{" "}
                                  <span className="font-mono font-semibold">{panjang}</span>
                                  {cutData.panjang && (
                                    <>
                                      {" · "}Hasil:{" "}
                                      <span className={`font-mono font-semibold ${
                                        parseInt(cutData.panjang) >= parseInt(panjang)
                                          ? "text-destructive"
                                          : "text-primary"
                                      }`}>
                                        {buildDestiny(destiny, cutData.panjang, tinggi)}
                                      </span>
                                      {parseInt(cutData.panjang) >= parseInt(panjang) && (
                                        <span className="text-destructive ml-1">
                                          ✕ harus lebih kecil dari {panjang}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label>Nama Mekanik</Label>
                                <Input
                                  value={cutData.mekanik}
                                  onChange={(e) => setCutData({ ...cutData, mekanik: e.target.value })}
                                  placeholder="Nama Mekanik"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  Keterangan{" "}
                                  <span className="text-muted-foreground text-xs">(opsional)</span>
                                </Label>
                                <Input
                                  value={cutData.keterangan}
                                  onChange={(e) => setCutData({ ...cutData, keterangan: e.target.value })}
                                  placeholder="Contoh: penyesuaian proses baru"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handlePotong} disabled={actionLoading}>
                                {actionLoading ? "Menyimpan..." : "Simpan"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      );
                    })()}
                  </div>

                  {/* Cetak PDF Riwayat — Admin */}
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      generateReedHistoryPDF(
                        selectedReed.id_sisir,
                        selectedReed.nomor_sisir_destiny,
                        reedHistory,
                        currentUser?.nama || "___________________"
                      )
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                  </Button>
                </div>
              )}

              {/* Cetak PDF Riwayat — Non-Admin */}
              {!isAdmin && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() =>
                    generateReedHistoryPDF(
                      selectedReed.id_sisir,
                      selectedReed.nomor_sisir_destiny,
                      reedHistory,
                      currentUser?.nama || "___________________"
                    )
                  }
                >
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              )}

              {/* Riwayat */}
              <div>
                <h3 className="font-semibold mb-3 text-sm">
                  Riwayat Pemakaian ({reedHistory.length} catatan)
                </h3>
                {reedHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat</p>
                ) : (
                  <div className="space-y-2">
                    {reedHistory.map((h, i) => (
                      <div
                        key={i}
                        className="text-sm border-l-2 border-border pl-3 py-1"
                        style={{
                          borderColor:
                            h.type === "PASANG"
                              ? "hsl(var(--primary))"
                              : "hsl(var(--destructive))",
                        }}
                      >
                        <div className="flex justify-between font-medium">
                          <span>{h.type} di Mesin {h.nomor_mesin}</span>
                          <span className="text-muted-foreground text-xs">{formatDate(h.tanggal)}</span>
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Mekanik: {h.nama_mekanik}
                          {h.kondisi_sisir ? ` · ${h.kondisi_sisir}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}