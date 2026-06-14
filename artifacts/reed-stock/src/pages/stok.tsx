import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Settings, Scissors, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReedHistoryPDF } from "@/lib/pdf";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Map the raw status string to a display label for filtering
const getDisplayStatus = (raw: string): string => {
  const s = (raw || "").trim().toUpperCase();
  if (s.includes("GUDANG")) return "Gudang";
  if (s.includes("DIPAKAI") || s.includes("PAKAI")) return "Dipakai";
  if (s.includes("RUSAK")) return "Rusak";
  if (s.includes("SUPPLIER")) return "Supplier";
  return raw || "-";
};

export default function StokPage() {
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Semua");

  const [selectedReed, setSelectedReed] = useState<MasterStok | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [newReed, setNewReed] = useState({
    "ID SISIR": "",
    "Nomor sisir Destiny": "",
    "Merk Supplier": "",
  });
  const [cutDimensi, setCutDimensi] = useState("");

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
      await addRowToSheet("MASTER_STOK", {
        ...newReed,
        "Posisi Rak": "",
        "Status Saat Ini": "DI GUDANG",
        "Mesin Terpasang": "",
        "Kondisi Sisir": "BAGUS",
      });
      toast.success("Sisir berhasil ditambahkan");
      setNewReed({ "ID SISIR": "", "Nomor sisir Destiny": "", "Merk Supplier": "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleService = async () => {
    if (!selectedReed) return;
    try {
      await updateRowInSheet("MASTER_STOK", "ID SISIR", selectedReed["ID SISIR"], {
        "Status Saat Ini": "DI SUPPLIER",
        "Mesin Terpasang": "",
      });
      toast.success("Status diubah ke Di Supplier");
      setIsDetailOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePotong = async () => {
    if (!selectedReed || !cutDimensi) {
      toast.error("Isi dimensi baru");
      return;
    }
    try {
      await updateRowInSheet("MASTER_STOK", "ID SISIR", selectedReed["ID SISIR"], {
        "Nomor sisir Destiny": cutDimensi,
        "Kondisi Sisir": `Dipotong ${new Date().toLocaleDateString("id-ID")}`,
      });
      toast.success("Spesifikasi berhasil diupdate");
      setCutDimensi("");
      setIsDetailOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredStok =
    filter === "Semua"
      ? stok
      : stok.filter((s) => getDisplayStatus(s["Status Saat Ini"]) === filter);

  const reedHistory = historyData.filter((h) => h.ID_Sisir === selectedReed?.["ID SISIR"]);

  const statusBadge = (raw: string) => {
    const label = getDisplayStatus(raw);
    const styles: Record<string, string> = {
      Gudang: "bg-blue-500/20 text-blue-400 border-blue-500/40",
      Dipakai: "bg-primary/20 text-primary border-primary/40",
      Rusak: "bg-destructive/20 text-destructive border-destructive/40",
      Supplier: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    };
    return (
      <Badge variant="outline" className={styles[label] ?? "bg-muted text-muted-foreground border-border"}>
        {label}
      </Badge>
    );
  };

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
            </div>
            <DialogFooter>
              <Button onClick={handleAddReed}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="Semua">Semua</TabsTrigger>
          <TabsTrigger value="Gudang">Gudang</TabsTrigger>
          <TabsTrigger value="Dipakai">Dipakai</TabsTrigger>
          <TabsTrigger value="Rusak">Rusak</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredStok.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          Tidak ada data untuk filter ini.
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredStok.map((item) => (
            <div
              key={item["ID SISIR"]}
              onClick={() => { setSelectedReed(item); setIsDetailOpen(true); }}
              className="bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold font-mono">{item["ID SISIR"]}</div>
                <div className="text-sm text-muted-foreground">{item["Nomor sisir Destiny"]} · {item["Merk Supplier"]}</div>
              </div>
              {statusBadge(item["Status Saat Ini"])}
            </div>
          ))}
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
                  {statusBadge(selectedReed["Status Saat Ini"])}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Nomor Destiny</p><p className="font-medium">{selectedReed["Nomor sisir Destiny"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Merk Supplier</p><p className="font-medium">{selectedReed["Merk Supplier"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Mesin Terpasang</p><p className="font-medium">{selectedReed["Mesin Terpasang"] || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Posisi Rak</p><p className="font-medium">{selectedReed["Posisi Rak"] || "-"}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Kondisi</p><p className="font-medium">{selectedReed["Kondisi Sisir"] || "-"}</p></div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleService}>
                    <Settings className="w-4 h-4 mr-2" /> Ke Supplier
                  </Button>
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
                          <Input value={cutDimensi} onChange={(e) => setCutDimensi(e.target.value)} placeholder="Contoh: 32X78X115" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handlePotong}>Simpan</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Button variant="secondary" className="w-full" onClick={() => generateReedHistoryPDF(selectedReed["ID SISIR"], selectedReed["Nomor sisir Destiny"], reedHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-sm">Riwayat Pemakaian ({reedHistory.length} catatan)</h3>
                {reedHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat</p>
                ) : (
                  <div className="space-y-2">
                    {reedHistory.map((h, i) => (
                      <div key={i} className="text-sm border-l-2 border-border pl-3 py-1">
                        <div className="flex justify-between font-medium">
                          <span>{h.type} di Mesin {h.Nomor_Mesin}</span>
                          <span className="text-muted-foreground text-xs">{h.tanggal ? new Date(h.tanggal).toLocaleDateString("id-ID") : "-"}</span>
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
