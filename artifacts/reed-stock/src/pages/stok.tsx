import { useState, useEffect, useCallback } from "react";
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
  const status = (item["Status Saat Ini"] || "").trim().toUpperCase();
  const kondisi = (item["Kondisi Sisir"] || "").trim().toUpperCase();
  if (status.includes("DIPAKAI") || status.includes("PAKAI")) return "Dipakai";
  if (status.includes("SERVICE") || status.includes("REPAIR") || status.includes("SUPPLIER")) return "Service";
  if (status.includes("RUSAK") || kondisi.includes("RUSAK")) return "Rusak";
  if (status.includes("GUDANG")) return "Gudang";
  return status || "-";
};

type FilterKey = "Semua" | "Gudang" | "Dipakai" | "Rusak" | "Service";

export default function StokPage() {
  const { isAdmin } = useAuth();
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedReed, setSelectedReed] = useState<MasterStok | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [newReed, setNewReed] = useState({
    "ID SISIR": "",
    "Nomor sisir Destiny": "",
    "Merk Supplier": "",
    "Posisi Rak": "",
  });
  const [cutData, setCutData] = useState({ dimensi: "", mekanik: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const stokData: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s["ID SISIR"] && s["ID SISIR"].trim() !== ""
      );
      const hpData: HistoryPasang[] = sheets["HISTORY_PASANG"] || [];
      const hlData: HistoryLepas[] = sheets["HISTORY_LEPAS"] || [];

      setStok(stokData);

      const combined: CombinedHistory[] = [
        ...hpData.map((h) => ({
          type: "PASANG" as const,
          Nomor_Mesin: h.Nomor_Mesin,
          ID_Sisir: h.ID_Sisir,
          Nomor_sisir_Destiny: h.Nomor_sisir_Destiny,
          Nama_Mekanik: h.Nama_Mekanik,
          tanggal: h.Tanggal_Ganti,
        })),
        ...hlData.map((h) => ({
          type: "LEPAS" as const,
          Nomor_Mesin: h.Nomor_Mesin,
          ID_Sisir: h.ID_Sisir,
          Nomor_sisir_Destiny: h.Nomor_sisir_Destiny,
          Nama_Mekanik: h.Nama_Mekanik,
          tanggal: h.Tanggal_Lepas,
          Kondisi_SIsir: h.Kondisi_SIsir,
        })),
      ];
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);

      if (selectedReed) {
        const updated = stokData.find((s) => s["ID SISIR"] === selectedReed["ID SISIR"]);
        if (updated) setSelectedReed(updated);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat stok");
    } finally {
      setLoading(false);
    }
  }, [selectedReed]);

  useEffect(() => { loadData(); }, []);

  const handleAddReed = async () => {
    if (!newReed["ID SISIR"]) {
      toast.error("ID Sisir harus diisi");
      return;
    }
    try {
      await addRowToSheet("HISTORY_LEPAS", {
        ...newReed,
        "Nomor_Mesin": "Dari Supplier",
        "Nama_Mekanik": "",
        "Kondisi Sisi": "BAGUS",
      });
      toast.success("Sisir berhasil ditambahkan");
      setNewReed({ "ID SISIR": "", "Nomor sisir Destiny": "", "Merk Supplier": "", "Posisi Rak": "" });
      setTimeout(() => loadData(), 1500);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  const handleKirimService = async () => {
    if (!selectedReed) return;

    const id = selectedReed["ID SISIR"];
    try {
      const tanggal = new Date().toISOString();

      // MURNI MENGIRIM DATA BARU KE TAB HISTORY_LEPAS
      // Membiarkan Rumus Array Anda di spreadsheet yang mendeteksi baris ini
      await addRowToSheet("HISTORY_LEPAS", {
        Tanggal_Lepas: tanggal,
        Nomor_Mesin: "Kirim Supplier",
        ID_Sisir: id,
        Nomor_sisir_Destiny: selectedReed["Nomor sisir Destiny"] || selectedReed.Nomor_sisir_Destiny || "",
        Nama_Mekanik: "-", 
        Kondisi_SIsir: "RUSAK",
      });

      toast.success("Sisir berhasil dicatat ke History Lepas untuk Service");
      setIsDetailOpen(false);
      setTimeout(() => loadData(), 1500);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim data service");
    }
  };
  const handleTerimaService = async () => {
      if (!selectedReed) return;

      // PERBAIKAN: Ambil ID dan Nomor Destiny langsung dari properti objek selectedReed yang sesuai
      const idSisir = selectedReed.id || selectedReed.id_sisir || selectedReed["ID SISIR"];
      const nomorDestiny = selectedReed.nomor_destiny || selectedReed.nomorDestiny || selectedReed["Nomor Destiny"];

      const tanggalSekarang = new Date().toISOString(); 

      try {
        await addRowToSheet("HISTORY_LEPAS", {
          "Tanggal_Lepas": tanggalSekarang,
          "Nomor_Mesin": "DARI SUPPLIER", 
          "ID_Sisir": idSisir, // Menggunakan variabel yang sudah diperbaiki
          "Nomor_sisir_Destiny": selectedReed["Nomor sisir Destiny"] || selectedReed.Nomor_sisir_Destiny || "",
          "Nama_Mekanik": "-", 
          "Kondisi_SIsir": "BAIK" 
        });

        toast.success("Data berhasil masuk ke History Lepas");
        setIsDetailOpen(false);
        setTimeout(() => loadData(), 1500);
      } catch (err: any) {
        toast.error(err.message);
      }
  };
  const handlePotong = async () => {
    if (!selectedReed || !cutData.dimensi) {
      toast.error("Isi dimensi baru");
      return;
    }
    try {
      await updateRowInSheet("MASTER_STOK", "ID SISIR", selectedReed["ID SISIR"], {
        "Nomor sisir Destiny": cutData.dimensi,
        "Kondisi Sisir": `Dipotong ${new Date().toLocaleDateString("id-ID")}${cutData.mekanik ? " oleh " + cutData.mekanik : ""}`,
      });
      toast.success("Spesifikasi berhasil diupdate");
      setCutData({ dimensi: "", mekanik: "" });
      setIsDetailOpen(false);
      setTimeout(() => loadData(), 1500);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const counts: Record<FilterKey, number> = {
    Semua: stok.length,
    Gudang: stok.filter((s) => getEffectiveStatus(s) === "Gudang").length,
    Dipakai: stok.filter((s) => getEffectiveStatus(s) === "Dipakai").length,
    Rusak: stok.filter((s) => getEffectiveStatus(s) === "Rusak").length,
    Service: stok.filter((s) => getEffectiveStatus(s) === "Service").length,
  };

  const filteredStok = (() => {
    let list = filter === "Semua" ? stok : stok.filter((s) => getEffectiveStatus(s) === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s["ID SISIR"]?.toLowerCase().includes(q) ||
          s["Nomor sisir Destiny"]?.toLowerCase().includes(q) ||
          s["Merk Supplier"]?.toLowerCase().includes(q) ||
          s["Posisi Rak"]?.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  const reedHistory = historyData.filter((h) => h.ID_Sisir === selectedReed?.["ID SISIR"]);

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Master Stok Sisir</h1>
        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Sisir Baru</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ID Sisir</Label>
                  <Input value={newReed["ID SISIR"]} onChange={(e) => setNewReed({ ...newReed, "ID SISIR": e.target.value })} placeholder="Contoh: SKR-100" />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Sisir Destiny</Label>
                  <Input value={newReed["Nomor sisir Destiny"]} onChange={(e) => setNewReed({ ...newReed, "Nomor sisir Destiny": e.target.value })} placeholder="Contoh: 32X78X100" />
                </div>
                <div className="space-y-2">
                  <Label>Merk Supplier</Label>
                  <Input value={newReed["Merk Supplier"]} onChange={(e) => setNewReed({ ...newReed, "Merk Supplier": e.target.value })} placeholder="Contoh: SETIA KIJI REED" />
                </div>
                <div className="space-y-2">
                  <Label>Posisi Rak</Label>
                  <Input value={newReed["Posisi Rak"]} onChange={(e) => setNewReed({ ...newReed, "Posisi Rak": e.target.value })} placeholder="Contoh: RAK A1" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddReed}>Simpan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search Bar */}
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
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">✕</button>
        )}
      </div>

      {/* Filter Tabs with counts */}
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
                key={item["ID SISIR"]}
                onClick={() => { setSelectedReed(item); setIsDetailOpen(true); }}
                className={`bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between ${locked ? "opacity-80" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-bold font-mono flex items-center gap-2">
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {item["ID SISIR"]}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{item["Nomor sisir Destiny"]} · {item["Merk Supplier"]}</div>
                  {item["Posisi Rak"] && <div className="text-xs text-muted-foreground/60">{item["Posisi Rak"]}</div>}
                </div>
                {statusBadge(item)}
              </div>
            );
          })}
        </div>
      )}

      {/* Reed Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedReed && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start pr-6">
                  <DialogTitle className="font-mono">{selectedReed["ID SISIR"]}</DialogTitle>
                  {statusBadge(selectedReed)}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Nomor Destiny</p><p className="font-medium">{selectedReed["Nomor sisir Destiny"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Merk Supplier</p><p className="font-medium">{selectedReed["Merk Supplier"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Mesin Terpasang</p><p className="font-medium">{selectedReed["Mesin Terpasang"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Posisi Rak</p><p className="font-medium">{selectedReed["Posisi Rak"] || "-"}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Kondisi</p><p className="font-medium">{selectedReed["Kondisi Sisir"] || "-"}</p></div>
              </div>

              {/* Lock notice for in-use */}
              {isLocked && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  Sisir sedang terpasang di mesin <strong>{selectedReed["Mesin Terpasang"]}</strong>. Lepas dari mesin terlebih dahulu sebelum mengubah status.
                </div>
              )}

              {/* Action buttons — only for admin AND not locked */}
              {isAdmin && !isLocked && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                  <div className="flex gap-2 flex-wrap">

                    {/* Kirim Service: available when in gudang or rusak */}
                    {!isService && (
                      <Button
                        variant="outline"
                        className="flex-1 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                        onClick={handleKirimService}
                      >
                        <Settings className="w-4 h-4 mr-2" /> Kirim Service
                      </Button>
                    )}

                    {/* Terima Service: only when status is Service */}
                    {isService && (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleTerimaService}
                      >
                        <PackageCheck className="w-4 h-4 mr-2" /> Terima Service
                      </Button>
                    )}

                    {/* Potong: only available for gudang/stok (not rusak/service/dipakai) */}
                    {!isRusak && !isService && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            <Scissors className="w-4 h-4 mr-2" /> Potong
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Potong Sisir {selectedReed["ID SISIR"]}</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Dimensi Baru (Destiny)</Label>
                              <Input value={cutData.dimensi} onChange={(e) => setCutData({ ...cutData, dimensi: e.target.value })} placeholder="Contoh: 32X78X115" />
                            </div>
                            <div className="space-y-2">
                              <Label>Nama Mekanik</Label>
                              <Input value={cutData.mekanik} onChange={(e) => setCutData({ ...cutData, mekanik: e.target.value })} placeholder="Nama Mekanik" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handlePotong}>Simpan</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Terima Rusak back to gudang */}
                    {isRusak && (
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={handleTerimaService}
                      >
                        <Wrench className="w-4 h-4 mr-2" /> Selesai Perbaiki
                      </Button>
                    )}
                  </div>

                  <Button variant="secondary" className="w-full" onClick={() => generateReedHistoryPDF(selectedReed["ID SISIR"], selectedReed["Nomor sisir Destiny"], reedHistory)}>
                    <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                  </Button>
                </div>
              )}

              {/* Public: only PDF */}
              {!isAdmin && (
                <Button variant="secondary" className="w-full" onClick={() => generateReedHistoryPDF(selectedReed["ID SISIR"], selectedReed["Nomor sisir Destiny"], reedHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              )}

              <div>
                <h3 className="font-semibold mb-3 text-sm">Riwayat Pemakaian ({reedHistory.length} catatan)</h3>
                {reedHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat</p>
                ) : (
                  <div className="space-y-2">
                    {reedHistory.map((h, i) => (
                      <div key={i} className="text-sm border-l-2 border-border pl-3 py-1"
                        style={{ borderColor: h.type === "PASANG" ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
                        <div className="flex justify-between font-medium">
                          <span>{h.type} di Mesin {h.Nomor_Mesin}</span>
                          <span className="text-muted-foreground text-xs">{formatDate(h.tanggal)}</span>
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Mekanik: {h.Nama_Mekanik}{h.Kondisi_SIsir ? ` · ${h.Kondisi_SIsir}` : ""}
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
