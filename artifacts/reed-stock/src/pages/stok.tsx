import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Settings, Scissors, AlertCircle, Search, Lock, Wrench, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReedHistoryPDF } from "@/lib/pdf";
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
  // status_saat_ini adalah sumber utama — selalu diupdate saat aksi dilakukan
  const status = (item.status_saat_ini || "").trim().toUpperCase();
  if (status.includes("DIPAKAI") || status.includes("PAKAI")) return "Dipakai";
  if (status.includes("SERVICE") || status.includes("REPAIR")) return "Service";
  if (status.includes("RUSAK")) return "Rusak";
  if (status.includes("GUDANG")) return "Gudang";
  // Fallback: jika status tidak dikenali, cek kondisi_sisir
  const kondisi = (item.kondisi_sisir || "").trim().toUpperCase();
  if (kondisi.includes("RUSAK")) return "Rusak";
  return status || "-";
};

type FilterKey = "Semua" | "Gudang" | "Dipakai" | "Rusak" | "Service";

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

  const [newReed, setNewReed] = useState({
    id_sisir: "",
    nomor_sisir_destiny: "",
    merk_supplier: "",
    posisi_rak: "",
  });
  const [cutData, setCutData] = useState({ dimensi: "", mekanik: "" });

  const selectedReedRef = useRef<MasterStok | null>(null);
  selectedReedRef.current = selectedReed;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const stokData: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s.id_sisir && s.id_sisir.trim() !== ""
      );
      const hpData: HistoryPasang[] = sheets["HISTORY_PASANG"] || [];
      const hlData: HistoryLepas[] = sheets["HISTORY_LEPAS"] || [];

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
        ...newReed,
        id_sisir: idTrim,
        status_saat_ini: "GUDANG",
        kondisi_sisir: "BAGUS",
      });
      toast.success("Sisir berhasil ditambahkan");
      setNewReed({ id_sisir: "", nomor_sisir_destiny: "", merk_supplier: "", posisi_rak: "" });
      setIsAddOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah sisir");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Kirim Service (GUDANG → SERVICE) ────────────────────────────────────
  const handleKirimService = async () => {
    if (!selectedReed) return;
    const id = selectedReed.id_sisir;
    const tanggal = new Date().toISOString();
    const supplier = selectedReed.merk_supplier || "Supplier";

    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", id, {
        status_saat_ini: "SERVICE",
        kondisi_sisir: "RUSAK",
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

  // ─── Kembalikan ke Gudang (SERVICE atau RUSAK → GUDANG BAGUS) ───────────
  const handleKembalikanKeGudang = async () => {
    if (!selectedReed) return;
    const idSisir = selectedReed.id_sisir;
    const nomorDestiny = selectedReed.nomor_sisir_destiny || "";
    const tanggalSekarang = new Date().toISOString();
    const supplier = selectedReed.merk_supplier || "Supplier";
    const catatanMesin = isService ? `Diterima dari ${supplier}` : "SELESAI PERBAIKI";

    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", idSisir, {
        status_saat_ini: "GUDANG",
        kondisi_sisir: "BAGUS",
        mesin_terpasang: null,
      });

      await addRowToSheet("HISTORY_LEPAS", {
        tanggal_lepas: tanggalSekarang,
        nomor_mesin: catatanMesin,
        id_sisir: idSisir,
        nomor_sisir_destiny: nomorDestiny,
        nama_mekanik: currentUser?.nama || "-",
        kondisi_sisir: "BAIK",
        created_by: currentUser?.nama || "-",
      });

      toast.success("Sisir berhasil dikembalikan ke stok gudang");
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status sisir");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Potong Sisir ─────────────────────────────────────────────────────────
  const handlePotong = async () => {
    if (!selectedReed || !cutData.dimensi) {
      toast.error("Isi dimensi baru");
      return;
    }
    const updates = {
      nomor_sisir_destiny: cutData.dimensi,
      kondisi_sisir: `Dipotong ${new Date().toLocaleDateString("id-ID")}${cutData.mekanik ? " oleh " + cutData.mekanik : ""}`,
    };
    setActionLoading(true);
    try {
      await updateRowInSheet("MASTER_STOK", "id_sisir", selectedReed.id_sisir, updates);
      toast.success("Spesifikasi berhasil diupdate");
      setCutData({ dimensi: "", mekanik: "" });
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal update data potong");
    } finally {
      setActionLoading(false);
    }
  };


  // ─── Counts & Filter ──────────────────────────────────────────────────────
  // 1. Filter berdasarkan search query dulu (tanpa tab filter)
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

  // 2. Hitung counts dari hasil search (bukan dari data asli)
  const counts: Record<FilterKey, number> = {
    Semua: searchFilteredStok.length,
    Gudang: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Gudang").length,
    Dipakai: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Dipakai").length,
    Rusak: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Rusak").length,
    Service: searchFilteredStok.filter((s) => getEffectiveStatus(s) === "Service").length,
  };

  // 3. Filter berdasarkan tab + search (untuk tampilan list)
  const filteredStok = (() => {
    let list = filter === "Semua" ? searchFilteredStok : searchFilteredStok.filter((s) => getEffectiveStatus(s) === filter);
    return list;
  })();

  const reedHistory = historyData.filter((h) => h.id_sisir === selectedReed?.id_sisir);

  const statusBadge = (item: MasterStok) => {
    const label = getEffectiveStatus(item);
    const styles: Record<string, string> = {
      Gudang: "bg-blue-500/20 text-blue-400 border-blue-500/40",
      Dipakai: "bg-primary/20 text-primary border-primary/40",
      Rusak: "bg-destructive/20 text-destructive border-destructive/40",
      Service: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    };
    return (
      <Badge variant="outline" className={styles[label] ?? "bg-muted text-muted-foreground border-border"}>
        {label}
      </Badge>
    );
  };

  const selectedStatus = selectedReed ? getEffectiveStatus(selectedReed) : "";
  const isLocked = selectedStatus === "Dipakai";
  const isRusak = selectedStatus === "Rusak";
  const isService = selectedStatus === "Service";

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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Master Stok Sisir</h1>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah</Button>
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
                  <Input
                    value={newReed.nomor_sisir_destiny}
                    onChange={(e) => setNewReed({ ...newReed, nomor_sisir_destiny: e.target.value })}
                    placeholder="Contoh: 32X78X100"
                  />
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

      {/* Search */}
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

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="w-full grid grid-cols-5 h-auto">
          {(["Semua", "Gudang", "Dipakai", "Rusak", "Service"] as FilterKey[]).map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex-col gap-0 py-1.5 text-xs">
              <span>{tab}</span>
              <span className="text-[10px] font-bold text-primary">{counts[tab]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* List */}
      {filteredStok.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          {searchQuery ? "Tidak ditemukan." : "Tidak ada data untuk filter ini."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredStok.map((item) => {
            const disp = getEffectiveStatus(item);
            const locked = disp === "Dipakai";
            return (
              <div
                key={item.id_sisir}
                onClick={() => { setSelectedReed(item); setIsDetailOpen(true); }}
                className={`bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between ${locked ? "opacity-80" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-bold font-mono flex items-center gap-2">
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
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

      {/* Detail Dialog */}
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

              {/* Warning: Dipakai / Terpasang */}
              {isLocked && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  Sisir sedang terpasang di mesin <strong>{selectedReed.mesin_terpasang}</strong>.
                  Lepas dari mesin terlebih dahulu sebelum mengubah status.
                </div>
              )}

              {/* Warning: Rusak */}
              {isRusak && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Sisir berstatus <strong>RUSAK</strong> tidak dapat dipasang ke mesin manapun.
                  Klik "Selesai Perbaiki" setelah sisir diperbaiki agar bisa dipakai kembali.
                </div>
              )}

              {/* Aksi (Admin only, tidak locked) */}
              {isAdmin && !isLocked && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                  <div className="flex gap-2 flex-wrap">

                    {/* Kirim Service — hanya jika bukan service dan bukan rusak */}
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

                    {/* Terima Service — hanya jika status service */}
                    {isService && (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleKembalikanKeGudang}
                        disabled={actionLoading}
                      >
                        <PackageCheck className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Terima Service"}
                      </Button>
                    )}

                    {/* Potong — hanya jika bukan rusak dan bukan service */}
                    {!isRusak && !isService && (
                      <Dialog>
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
                              <Label>Dimensi Baru (Destiny)</Label>
                              <Input
                                value={cutData.dimensi}
                                onChange={(e) => setCutData({ ...cutData, dimensi: e.target.value })}
                                placeholder="Contoh: 32X78X115"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Nama Mekanik</Label>
                              <Input
                                value={cutData.mekanik}
                                onChange={(e) => setCutData({ ...cutData, mekanik: e.target.value })}
                                placeholder="Nama Mekanik"
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
                    )}

                    {/* Selesai Perbaiki — hanya jika status rusak */}
                    {isRusak && (
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={handleKembalikanKeGudang}
                        disabled={actionLoading}
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        {actionLoading ? "Memproses..." : "Selesai Perbaiki"}
                      </Button>
                    )}
                  </div>

                  {/* Cetak PDF — Admin */}
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

              {/* Cetak PDF — Non-Admin */}
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
