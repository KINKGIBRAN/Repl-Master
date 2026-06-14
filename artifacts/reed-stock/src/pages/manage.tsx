import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { LiveTracking, MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, History, FileText, ArrowRightCircle, ArrowDownCircle, AlertCircle, Search, Clock, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateMachineHistoryPDF } from "@/lib/pdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// HELPER: Menghitung durasi pemasangan secara real-time dalam satuan hari
const calculateDuration = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("/");
    let pasangDate: Date;
    if (parts.length === 3) {
      pasangDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      pasangDate = new Date(dateStr);
    }

    if (isNaN(pasangDate.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    pasangDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - pasangDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 0 ? "Hari ini" : `${diffDays} hari`;
  } catch (e) {
    return "";
  }
};

const isGudang = (s: MasterStok) =>
  s["Status Saat Ini"]?.trim().toLowerCase().includes("gudang") ?? false;

export default function ManagePage() {
  const [machines, setMachines] = useState<LiveTracking[]>([]);
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);

  const [selectedMachine, setSelectedMachine] = useState<LiveTracking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [newMachine, setNewMachine] = useState({ Nomer_Mesin: "", SN_Mesin: "", Jenis_Mesin: "", Posisi_Gedung: "" });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editMachineData, setEditMachineData] = useState({ Nomer_Mesin: "", Posisi_Gedung: "" });

  const [installData, setInstallData] = useState({ ID_sisir_terpasang: "", Nama_Mekanik: "" });
  const [removeData, setRemoveData] = useState({ Kondisi_SIsir: "", Nama_Mekanik: "" });

  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["LIVE_TRACKING", "MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const trackData: LiveTracking[] = (sheets["LIVE_TRACKING"] || []).filter(
        (m: LiveTracking) => m.Nomer_Mesin && m.Nomer_Mesin.trim() !== ""
      );
      const stokData: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s["ID SISIR"] && s["ID SISIR"].trim() !== ""
      );
      const hpData: HistoryPasang[] = sheets["HISTORY_PASANG"] || [];
      const hlData: HistoryLepas[] = sheets["HISTORY_LEPAS"] || [];

      setMachines(trackData);
      setStok(stokData);

      // FIX: Pemetaan dengan proteksi multi-nama kolom dari Google Sheets Apps Script
      const combined: CombinedHistory[] = [
        ...hpData.map((h: any) => ({
          type: "PASANG" as const,
          Nomor_Mesin: h.Nomor_Mesin || h.Nomor_mesin || h.Nomer_Mesin || "",
          ID_Sisir: h.ID_Sisir || h.ID_sisir || h["ID SISIR"] || "",
          Nomor_sisir_Destiny: h.Nomor_sisir_Destiny || h["Nomor sisir Destiny"] || h.Nomor_Sisir_Destiny || h.nomor_sisir_destiny || "",
          Nama_Mekanik: h.Nama_Mekanik || h.nama_mekanik || "",
          tanggal: h.Tanggal_Ganti || h.tanggal || h.Tanggal || "",
        })),
        ...hlData.map((h: any) => ({
          type: "LEPAS" as const,
          Nomor_Mesin: h.Nomor_Mesin || h.Nomor_mesin || h.Nomer_Mesin || "",
          ID_Sisir: h.ID_Sisir || h.ID_sisir || h["ID SISIR"] || "",
          Nomor_sisir_Destiny: h.Nomor_sisir_Destiny || h["Nomor sisir Destiny"] || h.Nomor_Sisir_Destiny || h.nomor_sisir_destiny || "",
          Nama_Mekanik: h.Nama_Mekanik || h.nama_mekanik || "",
          tanggal: h.Tanggal_Lepas || h.tanggal || h.Tanggal || "",
          Kondisi_SIsir: h.Kondisi_SIsir || h.Kondisi_Sisir || h.kondisi_sisir || "",
        })),
      ];
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);

      if (selectedMachine) {
        const updated = trackData.find((m) => m.Nomer_Mesin === selectedMachine.Nomer_Mesin);
        if (updated) setSelectedMachine(updated);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [selectedMachine]);

  useEffect(() => { loadData(); }, []);

  const handleAddMachine = async () => {
    if (!newMachine.Nomer_Mesin || !newMachine.Jenis_Mesin) {
      toast.error("No Mesin dan Jenis harus diisi");
      return;
    }
    try {
      await addRowToSheet("LIVE_TRACKING", {
        ...newMachine,
        ID_sisir_terpasang: "",
        Nomor_sisir_Destiny: "",
        Tanggal_Pasang: "",
        Durasi_Pakai: "",
      });
      toast.success("Mesin berhasil ditambahkan");
      setNewMachine({ Nomer_Mesin: "", SN_Mesin: "", Jenis_Mesin: "", Posisi_Gedung: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditMachine = async () => {
    if (!selectedMachine) return;
    if (!editMachineData.Nomer_Mesin.trim()) {
      toast.error("Nama/Nomor Mesin tidak boleh kosong");
      return;
    }
    try {
      await updateRowInSheet("LIVE_TRACKING", "Nomer_Mesin", selectedMachine.Nomer_Mesin, {
        Nomer_Mesin: editMachineData.Nomer_Mesin,
        Posisi_Gedung: editMachineData.Posisi_Gedung
      });
      toast.success("Data mesin berhasil diperbarui");
      setIsEditOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui data mesin");
    }
  };

  const openEditDialog = (machine: LiveTracking) => {
    setEditMachineData({
      Nomer_Mesin: machine.Nomer_Mesin || "",
      Posisi_Gedung: machine.Posisi_Gedung || ""
    });
    setIsEditOpen(true);
  };

  const handleInstallReed = async () => {
    if (!selectedMachine) return;
    if (!installData.ID_sisir_terpasang || !installData.Nama_Mekanik) {
      toast.error("Pilih Sisir dan isi nama Mekanik");
      return;
    }
    try {
      const tanggal = new Date().toLocaleDateString("id-ID");
      const sisirRow = stok.find((s) => s["ID SISIR"] === installData.ID_sisir_terpasang);

      await updateRowInSheet("LIVE_TRACKING", "Nomer_Mesin", selectedMachine.Nomer_Mesin, {
        ID_sisir_terpasang: installData.ID_sisir_terpasang,
        Nomor_sisir_Destiny: sisirRow?.["Nomor sisir Destiny"] || sisirRow?.Nomor_sisir_Destiny || "",
        Tanggal_Pasang: tanggal,
      });

      await updateRowInSheet("MASTER_STOK", "ID SISIR", installData.ID_sisir_terpasang, {
        "Status Saat Ini": "SEDANG DIPAKAI",
        "Mesin Terpasang": selectedMachine.Nomer_Mesin,
      });

      await addRowToSheet("HISTORY_PASANG", {
        Tanggal_Ganti: tanggal,
        Nomor_Mesin: selectedMachine.Nomer_Mesin,
        ID_Sisir: installData.ID_sisir_terpasang,
        Nomor_sisir_Destiny: sisirRow?.["Nomor sisir Destiny"] || sisirRow?.Nomor_sisir_Destiny || "",
        Nama_Mekanik: installData.Nama_Mekanik,
      });

      toast.success("Sisir berhasil dipasang");
      setInstallData({ ID_sisir_terpasang: "", Nama_Mekanik: "" });
      setIsDetailOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveReed = async () => {
    if (!selectedMachine || !selectedMachine.ID_sisir_terpasang) return;
    if (!removeData.Kondisi_SIsir || !removeData.Nama_Mekanik) {
      toast.error("Pilih Kondisi dan isi nama Mekanik");
      return;
    }
    try {
      const tanggal = new Date().toLocaleDateString("id-ID");
      const currentSisir = selectedMachine.ID_sisir_terpasang;
      const newStatus = removeData.Kondisi_SIsir.toUpperCase() === "BAIK" ? "DI GUDANG" : "RUSAK";

      await updateRowInSheet("LIVE_TRACKING", "Nomer_Mesin", selectedMachine.Nomer_Mesin, {
        ID_sisir_terpasang: "",
        Nomor_sisir_Destiny: "",
        Tanggal_Pasang: "",
      });

      await updateRowInSheet("MASTER_STOK", "ID SISIR", currentSisir, {
        "Status Saat Ini": newStatus,
        "Mesin Terpasang": "",
      });

      await addRowToSheet("HISTORY_LEPAS", {
        Tanggal_Lepas: tanggal,
        Nomor_Mesin: selectedMachine.Nomer_Mesin,
        ID_Sisir: currentSisir,
        Nomor_sisir_Destiny: selectedMachine.Nomor_sisir_Destiny || selectedMachine["Nomor sisir Destiny"] || "",
        Nama_Mekanik: removeData.Nama_Mekanik,
        Kondisi_SIsir: removeData.Kondisi_SIsir,
      });

      toast.success("Sisir berhasil dilepas");
      setRemoveData({ Kondisi_SIsir: "", Nama_Mekanik: "" });
      setIsDetailOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredMachines = machines.filter((machine) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const nomerMesin = machine.Nomer_Mesin?.toLowerCase() || "";
    const nomorSisirDisplay = (machine.Nomor_sisir_Destiny || machine["Nomor sisir Destiny"] || machine.ID_sisir_terpasang || "").toLowerCase();
    const posisiGedung = (machine.Posisi_Gedung || "").toLowerCase();

    return nomerMesin.includes(query) || nomorSisirDisplay.includes(query) || posisiGedung.includes(query);
  });

  const machineHistory = historyData
    .filter((h) => h.Nomor_Mesin === selectedMachine?.Nomer_Mesin)
    .slice(0, 10);

  const availableReeds = stok.filter(isGudang);

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
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Mesin</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Mesin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Mesin Baru</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>No Mesin</Label>
                <Input value={newMachine.Nomer_Mesin} onChange={(e) => setNewMachine({ ...newMachine, Nomer_Mesin: e.target.value })} placeholder="Contoh: M-01" />
              </div>
              <div className="space-y-2">
                <Label>SN Mesin</Label>
                <Input value={newMachine.SN_Mesin} onChange={(e) => setNewMachine({ ...newMachine, SN_Mesin: e.target.value })} placeholder="Serial Number" />
              </div>
              <div className="space-y-2">
                <Label>Posisi Gedung</Label>
                <Input value={newMachine.Posisi_Gedung} onChange={(e) => setNewMachine({ ...newMachine, Posisi_Gedung: e.target.value })} placeholder="Contoh: Gedung A / Weaving 1" />
              </div>
              <div className="space-y-2">
                <Label>Jenis Mesin</Label>
                <Input value={newMachine.Jenis_Mesin} onChange={(e) => setNewMachine({ ...newMachine, Jenis_Mesin: e.target.value })} placeholder="Contoh: Air Jet Loom" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddMachine} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          type="text"
          placeholder="Cari nomor mesin, sisir, atau gedung..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-12 h-10 rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {filteredMachines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          {searchQuery ? "Mesin, sisir, atau posisi gedung tidak ditemukan." : "Belum ada mesin. Tambahkan mesin pertama Anda."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredMachines.map((machine) => {
            const hasReed = machine.ID_sisir_terpasang && 
                            machine.ID_sisir_terpasang.trim() !== "" && 
                            machine.ID_sisir_terpasang.trim() !== "-";
            return (
              <div
                key={machine.Nomer_Mesin}
                onClick={() => { setSelectedMachine(machine); setIsDetailOpen(true); }}
                className="bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">{machine.Nomer_Mesin}</div>
                  <div className="text-sm text-muted-foreground">
                    {machine.Jenis_Mesin} · SN: {String(machine.SN_Mesin) || "-"}
                  </div>
                  {machine.Posisi_Gedung && (
                    <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> LOCATION: {machine.Posisi_Gedung}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className={`text-sm font-semibold ${hasReed ? "text-primary" : "text-muted-foreground/60"}`}>
                    {hasReed ? "Aktif" : "Non Aktif"}
                  </div>
                  {hasReed && (
                    <>
                      <div className="font-mono text-xs font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {machine.Nomor_sisir_Destiny || machine["Nomor sisir Destiny"] || machine.ID_sisir_terpasang}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        <span>{calculateDuration(machine.Tanggal_Pasang)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Machine Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedMachine && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
                <DialogTitle>Mesin {selectedMachine.Nomer_Mesin}</DialogTitle>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => openEditDialog(selectedMachine)} 
                  className="h-8 gap-1 text-xs border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Data
                </Button>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Jenis</p><p className="font-medium">{selectedMachine.Jenis_Mesin || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">SN Mesin</p><p className="font-medium">{String(selectedMachine.SN_Mesin) || "-"}</p></div>
                <div className="col-span-2 border-t pt-2 mt-1 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Posisi Gedung</p>
                    <p className="font-medium text-emerald-600">{selectedMachine.Posisi_Gedung || "-"}</p>
                  </div>
                </div>
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs text-muted-foreground">Sisir Terpasang</p>
                  <p className="font-medium font-mono text-primary">
                    {selectedMachine.ID_sisir_terpasang && selectedMachine.ID_sisir_terpasang.trim() !== "-" 
                      ? selectedMachine.Nomor_sisir_Destiny || selectedMachine["Nomor sisir Destiny"] || selectedMachine.ID_sisir_terpasang
                      : "Non Aktif"}
                  </p>
                </div>
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs text-muted-foreground">Durasi Pasang</p>
                  <p className="font-medium">
                    {selectedMachine.Tanggal_Pasang 
                      ? `${selectedMachine.Tanggal_Pasang} (${calculateDuration(selectedMachine.Tanggal_Pasang)})` 
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {(!selectedMachine.ID_sisir_terpasang || selectedMachine.ID_sisir_terpasang.trim() === "-") ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="flex-1">
                        <ArrowRightCircle className="mr-2 w-4 h-4" /> Pasang Sisir
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Pasang Sisir ke {selectedMachine.Nomer_Mesin}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Pilih Sisir (Stok Gudang)</Label>
                          <Select onValueChange={(v) => setInstallData({ ...installData, ID_sisir_terpasang: v })}>
                            <SelectTrigger><SelectValue placeholder="Pilih ID Sisir" /></SelectTrigger>
                            <SelectContent>
                              {availableReeds.length === 0 && (
                                <SelectItem value="_none" disabled>Tidak ada sisir di gudang</SelectItem>
                              )}
                              {availableReeds.map((r) => (
                                <SelectItem key={r["ID SISIR"]} value={r["ID SISIR"]}>
                                  {r["Nomor sisir Destiny"] || r.Nomor_sisir_Destiny} ({r["ID SISIR"]})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nama Mekanik</Label>
                          <Input value={installData.Nama_Mekanik} onChange={(e) => setInstallData({ ...installData, Nama_Mekanik: e.target.value })} placeholder="Nama Mekanik" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleInstallReed}>Konfirmasi Pasang</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <ArrowDownCircle className="mr-2 w-4 h-4" /> Lepas Sisir
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Lepas Sisir {selectedMachine.Nomor_sisir_Destiny || selectedMachine["Nomor sisir Destiny"] || selectedMachine.ID_sisir_terpasang}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Kondisi Sisir Setelah Dilepas</Label>
                          <Select onValueChange={(v) => setRemoveData({ ...removeData, Kondisi_SIsir: v })}>
                            <SelectTrigger><SelectValue placeholder="Pilih Kondisi" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BAIK">Baik → Kembali ke Gudang</SelectItem>
                              <SelectItem value="RUSAK">Rusak</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nama Mekanik</Label>
                          <Input value={removeData.Nama_Mekanik} onChange={(e) => setRemoveData({ ...removeData, Nama_Mekanik: e.target.value })} placeholder="Nama Mekanik" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="destructive" onClick={handleRemoveReed}>Konfirmasi Lepas</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                <Button variant="outline" onClick={() => generateMachineHistoryPDF(selectedMachine.Nomer_Mesin, selectedMachine.Jenis_Mesin, machineHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                  <History className="w-4 h-4" /> Riwayat Terakhir
                </h3>
                {machineHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat</p>
                ) : (
                  <div className="space-y-2">
                    {machineHistory.map((h, i) => (
                      <div
                        key={i}
                        className="text-sm border-l-2 pl-3 py-1"
                        style={{ borderColor: h.type === "PASANG" ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                      >
                        <div className="flex justify-between font-medium">
                          <span>{h.type} — {h.Nomor_sisir_Destiny || h.ID_Sisir}</span>
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

      {/* MODAL EDIT DATA NAMA & LOKASI */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Mesin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama / Nomor Mesin</Label>
              <Input 
                value={editMachineData.Nomer_Mesin} 
                onChange={(e) => setEditMachineData({ ...editMachineData, Nomer_Mesin: e.target.value })} 
                placeholder="Contoh: AC-01" 
              />
            </div>
            <div className="space-y-2">
              <Label>Posisi Gedung / Lokasi</Label>
              <Input 
                value={editMachineData.Posisi_Gedung} 
                onChange={(e) => setEditMachineData({ ...editMachineData, Posisi_Gedung: e.target.value })} 
                placeholder="Contoh: SHED3.1" 
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-xl text-xs text-muted-foreground space-y-1">
              <p><strong>Tipe Mesin:</strong> {selectedMachine?.Jenis_Mesin || "-"}</p>
              <p><strong>Serial Number:</strong> {String(selectedMachine?.SN_Mesin || "-")}</p>
              <p className="text-[10px] text-amber-600 font-medium mt-1.5">* Tipe dan SN bersifat paten & tidak dapat diubah di sini.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={handleEditMachine} className="bg-amber-600 hover:bg-amber-700 text-white">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      );
      }
