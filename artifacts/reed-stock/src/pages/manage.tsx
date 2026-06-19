import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { LiveTracking, MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, History, FileText, ArrowRightCircle, ArrowDownCircle, AlertCircle, Search, Clock, MapPin, Pencil, Lock, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateMachineHistoryPDF, generateLiveTrackingPDF, LiveTrackingRow } from "@/lib/pdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

const calculateDuration = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const pasangDate = new Date(dateStr);
    if (isNaN(pasangDate.getTime())) return "";
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - pasangDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 0 ? "Hari ini" : `${diffDays} hari`;
  } catch {
    return "";
  }
};

const isAvailable = (s: MasterStok) => {
  const status = (s.status_saat_ini || "").trim().toLowerCase();
  const kondisi = (s.kondisi_sisir || "").trim().toLowerCase();
  if (kondisi.includes("rusak")) return false;
  return status.includes("gudang") || status.includes("riching");
};

const isRichingStatus = (s: MasterStok) => {
  return (s.status_saat_ini || "").trim().toLowerCase().includes("riching");
};

const hasActiveReed = (machine: LiveTracking): boolean => {
  return !!(
    machine.id_sisir_terpasang &&
    machine.id_sisir_terpasang.trim() !== "" &&
    machine.id_sisir_terpasang.trim() !== "-"
  );
};

const findMekanikPasangTerakhir = (
  history: CombinedHistory[],
  nomorMesin: string,
  idSisir: string
): string => {
  if (!idSisir || idSisir === "-") return "-";
  const match = history.find(
    (h) => h.type === "PASANG" && h.nomor_mesin === nomorMesin && h.id_sisir === idSisir
  );
  return match?.nama_mekanik || "-";
};

type FilterKey = "Semua" | "Aktif" | "Non Aktif";

// ─── Searchable Reed Combobox ─────────────────────────────────────────────────
function ReedCombobox({
  reeds,
  value,
  onChange,
}: {
  reeds: MasterStok[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = reeds.find((r) => r.id_sisir === value);

  const filtered = reeds.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.id_sisir.toLowerCase().includes(q) ||
      (r.nomor_sisir_destiny || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected
            ? `${selected.nomor_sisir_destiny || "-"} (${selected.id_sisir})${isRichingStatus(selected) ? " · Riching" : ""}`
            : "Ketik ID Sisir atau Nomor Destiny..."}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          style={{ maxHeight: "220px", display: "flex", flexDirection: "column" }}
        >
          <div className="p-2 border-b border-border/50 shrink-0">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID Sisir / Nomor Destiny..."
              className="w-full rounded-lg border border-border/50 bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div style={{ overflowY: "scroll", WebkitOverflowScrolling: "touch", flex: 1 }}>
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada sisir tersedia.</p>
            ) : (
              filtered.map((r) => {
                const id = r.id_sisir;
                const destiny = r.nomor_sisir_destiny || "";
                const riching = isRichingStatus(r);
                const isSelected = value === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { onChange(id); setSearch(""); setOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10 transition-colors",
                      isSelected && "bg-primary/10 text-primary"
                    )}
                  >
                    <Check className={cn("h-4 w-4 shrink-0 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                    <div className="flex items-center justify-between w-full min-w-0 gap-2">
                      <span className="font-mono truncate">
                        {destiny} <span className="text-muted-foreground">({id})</span>
                      </span>
                      {riching && (
                        <span className="shrink-0 text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                          Riching
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
      )}
    </div>
  );
}

export default function ManagePage() {
  const { isAdmin, currentUser } = useAuth();
  const [machines, setMachines] = useState<LiveTracking[]>([]);
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<LiveTracking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [newMachine, setNewMachine] = useState({ nomer_mesin: "", sn_mesin: "", jenis_mesin: "", posisi_gedung: "" });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editMachineData, setEditMachineData] = useState({ nomer_mesin: "", posisi_gedung: "" });
  const [installData, setInstallData] = useState({ id_sisir_terpasang: "", nama_mekanik: "" });
  const [removeData, setRemoveData] = useState({ kondisi_sisir: "", nama_mekanik: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("Semua");

  const selectedMachineRef = useRef<LiveTracking | null>(null);
  selectedMachineRef.current = selectedMachine;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["LIVE_TRACKING", "MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const trackData: LiveTracking[] = (sheets["LIVE_TRACKING"] || []).filter(
        (m: LiveTracking) => m.nomer_mesin && m.nomer_mesin.trim() !== ""
      );
      const stokData: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s.id_sisir && s.id_sisir.trim() !== ""
      );
      const hpData: HistoryPasang[] = sheets["HISTORY_PASANG"] || [];
      const hlData: HistoryLepas[] = sheets["HISTORY_LEPAS"] || [];

      setMachines(trackData);
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

      const current = selectedMachineRef.current;
      if (current) {
        const updated = trackData.find((m) => m.nomer_mesin === current.nomer_mesin);
        if (updated) setSelectedMachine(updated);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddMachine = async () => {
    if (!newMachine.nomer_mesin || !newMachine.jenis_mesin) {
      toast.error("No Mesin dan Jenis harus diisi");
      return;
    }
    setActionLoading(true);
    try {
      await addRowToSheet("LIVE_TRACKING", {
        ...newMachine,
        id_sisir_terpasang: "-",
        nomor_sisir_destiny: "-",
        tanggal_pasang: null,
      });
      toast.success("Mesin berhasil ditambahkan");
      setNewMachine({ nomer_mesin: "", sn_mesin: "", jenis_mesin: "", posisi_gedung: "" });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah mesin");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditMachine = async () => {
    if (!selectedMachine) return;
    if (!editMachineData.nomer_mesin.trim()) {
      toast.error("Nama/Nomor Mesin tidak boleh kosong");
      return;
    }
    setActionLoading(true);
    try {
      await updateRowInSheet("LIVE_TRACKING", "nomer_mesin", selectedMachine.nomer_mesin, {
        nomer_mesin: editMachineData.nomer_mesin,
        posisi_gedung: editMachineData.posisi_gedung,
      });
      toast.success("Data mesin berhasil diperbarui");
      setIsEditOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui data mesin");
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (machine: LiveTracking) => {
    setEditMachineData({ nomer_mesin: machine.nomer_mesin || "", posisi_gedung: machine.posisi_gedung || "" });
    setIsEditOpen(true);
  };

  const handleInstallReed = async () => {
    if (!selectedMachine) return;
    if (!installData.id_sisir_terpasang || !installData.nama_mekanik) {
      toast.error("Pilih Sisir dan isi nama Mekanik");
      return;
    }
    const sisirRow = stok.find((s) => s.id_sisir === installData.id_sisir_terpasang);
    const sisirKondisi = (sisirRow?.kondisi_sisir || "").toUpperCase();
    if (sisirKondisi.includes("RUSAK")) {
      toast.error("Sisir dalam kondisi RUSAK tidak bisa dipasang!");
      return;
    }
    const tanggal = new Date().toISOString();
    const nomorDestiny = sisirRow?.nomor_sisir_destiny || "";
    setActionLoading(true);
    try {
      await updateRowInSheet("LIVE_TRACKING", "nomer_mesin", selectedMachine.nomer_mesin, {
        id_sisir_terpasang: installData.id_sisir_terpasang,
        nomor_sisir_destiny: nomorDestiny,
        tanggal_pasang: tanggal,
      });
      await updateRowInSheet("MASTER_STOK", "id_sisir", installData.id_sisir_terpasang, {
        status_saat_ini: "DIPAKAI",
        mesin_terpasang: selectedMachine.nomer_mesin,
      });
      await addRowToSheet("HISTORY_PASANG", {
        tanggal_ganti: tanggal,
        nomor_mesin: selectedMachine.nomer_mesin,
        id_sisir: installData.id_sisir_terpasang,
        nomor_sisir_destiny: nomorDestiny,
        nama_mekanik: installData.nama_mekanik,
        created_by: currentUser?.nama || "-",
      });
      toast.success("Sisir berhasil dipasang!");
      setInstallData({ id_sisir_terpasang: "", nama_mekanik: "" });
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memasang sisir");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveReed = async () => {
    if (!selectedMachine || !selectedMachine.id_sisir_terpasang) return;
    if (!removeData.kondisi_sisir || !removeData.nama_mekanik) {
      toast.error("Pilih Kondisi dan isi nama Mekanik");
      return;
    }
    const tanggal = new Date().toISOString();
    const currentSisir   = selectedMachine.id_sisir_terpasang;
    const currentMesin   = selectedMachine.nomer_mesin;
    const currentDestiny = selectedMachine.nomor_sisir_destiny || "";
    const kondisiUpper   = removeData.kondisi_sisir.toUpperCase();
    let newSisirStatus   = "GUDANG";
    let newSisirKondisi  = "BAGUS";
    if (kondisiUpper === "RUSAK") { newSisirStatus = "RUSAK"; newSisirKondisi = "RUSAK"; }

    setActionLoading(true);
    try {
      await updateRowInSheet("LIVE_TRACKING", "nomer_mesin", currentMesin, {
        id_sisir_terpasang: "-", nomor_sisir_destiny: "-", tanggal_pasang: null,
      });
      await updateRowInSheet("MASTER_STOK", "id_sisir", currentSisir, {
        status_saat_ini: newSisirStatus, kondisi_sisir: newSisirKondisi, mesin_terpasang: "",
      });
      await addRowToSheet("HISTORY_LEPAS", {
        tanggal_lepas: tanggal, nomor_mesin: currentMesin, id_sisir: currentSisir,
        nomor_sisir_destiny: currentDestiny, nama_mekanik: removeData.nama_mekanik,
        kondisi_sisir: removeData.kondisi_sisir, created_by: currentUser?.nama || "-",
      });
      toast.success("Sisir berhasil dilepas!");
      setRemoveData({ kondisi_sisir: "", nama_mekanik: "" });
      setIsDetailOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(`Gagal melepas sisir: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportLiveTrackingPDF = () => {
    const rows: LiveTrackingRow[] = [...machines]
      .sort((a, b) => {
        const aActive = hasActiveReed(a) ? 0 : 1;
        const bActive = hasActiveReed(b) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return (a.nomer_mesin || "").localeCompare(b.nomer_mesin || "");
      })
      .map((m) => {
        const aktif = hasActiveReed(m);
        return {
          nomor_mesin: m.nomer_mesin, jenis_mesin: m.jenis_mesin, posisi_gedung: m.posisi_gedung,
          id_sisir: aktif ? m.id_sisir_terpasang : "-",
          nomor_destiny: aktif ? (m.nomor_sisir_destiny || "-") : "-",
          durasi: aktif ? m.durasi_pakai || (m.tanggal_pasang ? calculateDuration(m.tanggal_pasang) : "-") : "-",
          mekanik: aktif ? findMekanikPasangTerakhir(historyData, m.nomer_mesin, m.id_sisir_terpasang) : "-",
          aktif,
        };
      });
    generateLiveTrackingPDF(rows, currentUser?.nama || "___________________");
  };

  const searchFilteredMachines = (() => {
    let list = machines;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.nomer_mesin?.toLowerCase().includes(q) ||
          (m.nomor_sisir_destiny || "").toLowerCase().includes(q) ||
          (m.id_sisir_terpasang || "").toLowerCase().includes(q) ||
          (m.posisi_gedung || "").toLowerCase().includes(q)
      );
    }
    return list;
  })();

  const counts: Record<FilterKey, number> = {
    Semua:       searchFilteredMachines.length,
    Aktif:       searchFilteredMachines.filter(hasActiveReed).length,
    "Non Aktif": searchFilteredMachines.filter((m) => !hasActiveReed(m)).length,
  };

  const filteredMachines = (() => {
    let list = searchFilteredMachines;
    if (filter === "Aktif")      list = list.filter(hasActiveReed);
    if (filter === "Non Aktif")  list = list.filter((m) => !hasActiveReed(m));
    return [...list].sort((a, b) => {
      const aActive = hasActiveReed(a) ? 0 : 1;
      const bActive = hasActiveReed(b) ? 0 : 1;
      return aActive - bActive;
    });
  })();

  const machineHistory        = historyData.filter((h) => h.nomor_mesin === selectedMachine?.nomer_mesin);
  const machineHistoryDisplay = machineHistory.slice(0, 10);
  const availableReeds        = stok.filter(isAvailable);

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
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Mesin</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleExportLiveTrackingPDF}
            className="border-border/60 hover:border-primary/50 hover:text-primary transition-all">
            <FileText className="mr-2 h-4 w-4" />Export PDF
          </Button>
          {isAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />Tambah Mesin
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-border/60 bg-card">
                <DialogHeader><DialogTitle>Tambah Mesin Baru</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  {[
                    { label: "No Mesin", key: "nomer_mesin", placeholder: "Contoh: M-01" },
                    { label: "SN Mesin", key: "sn_mesin", placeholder: "Serial Number" },
                    { label: "Posisi Gedung", key: "posisi_gedung", placeholder: "Contoh: Shed3.1" },
                    { label: "Jenis Mesin", key: "jenis_mesin", placeholder: "Contoh: PICANOL AJL" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
                      <Input
                        value={(newMachine as any)[key]}
                        onChange={(e) => setNewMachine({ ...newMachine, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="rounded-xl border-border/60 focus:ring-primary/40"
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button onClick={handleAddMachine} disabled={actionLoading} className="w-full sm:w-auto">
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
        <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? "text-primary" : "text-muted-foreground/60"}`} />
        <Input
          type="text"
          placeholder="Cari nomor mesin, ID sisir, atau gedung..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={`pl-9 pr-10 h-10 rounded-xl transition-all duration-200 ${searchFocused ? "ring-2 ring-primary/40 border-primary/50" : "border-border/50"}`}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList className="w-full grid grid-cols-3 h-auto bg-card border border-border/50 rounded-xl p-1">
          {(["Semua", "Aktif", "Non Aktif"] as FilterKey[]).map((tab) => (
            <TabsTrigger key={tab} value={tab}
              className="flex-col gap-0 py-1.5 text-xs rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary transition-all">
              <span>{tab}</span>
              <span className="text-[10px] font-bold">{counts[tab]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── Machine List ── */}
      {filteredMachines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border/50">
          {searchQuery ? "Tidak ditemukan." : "Belum ada mesin."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredMachines.map((machine, i) => {
            const active = hasActiveReed(machine);
            const durasi = machine.durasi_pakai || calculateDuration(machine.tanggal_pasang || "");
            return (
              <div
                key={machine.nomer_mesin}
                onClick={() => { setSelectedMachine(machine); setIsDetailOpen(true); }}
                className={`list-item-animate relative overflow-hidden rounded-xl border p-4 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:scale-[1.01] ${
                  active
                    ? "border-[#4A7FC1]/40 shadow-[0_0_12px_rgba(74,127,193,0.12)] hover:shadow-[0_0_18px_rgba(74,127,193,0.22)]"
                    : "border-border/30 bg-card opacity-60 shadow-none"
                }`}
                style={{
                  animationDelay: `${Math.min(i * 30, 300)}ms`,
                  background: active
                    ? "linear-gradient(135deg, rgba(74,127,193,0.10) 0%, rgba(74,127,193,0.03) 50%, rgba(17,30,46,1) 100%)"
                    : undefined,
                }}
              >
                {/* Active top-strip */}
                {active && (
                  <div className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ background: "linear-gradient(90deg, rgba(107,159,212,0.9), rgba(107,159,212,0.05))" }} />
                )}

                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    {/* Nama + status dot */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        active
                          ? "bg-[#6B9FD4] shadow-[0_0_6px_rgba(107,159,212,0.8)]"
                          : "bg-muted-foreground/25"
                      }`} />
                      <span className={`font-bold text-sm ${active ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {machine.nomer_mesin}
                      </span>
                    </div>

                    {/* Jenis + SN */}
                    <p className="text-xs text-muted-foreground/70 truncate ml-4">
                      {machine.jenis_mesin} · SN: {String(machine.sn_mesin) || "-"}
                    </p>

                    {/* Posisi */}
                    {machine.posisi_gedung && (
                      <p className="text-xs text-[#5BA3BF] mt-1 flex items-center gap-1 ml-4">
                        <MapPin className="w-3 h-3" /> {machine.posisi_gedung}
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="text-right flex flex-col items-end gap-1 ml-3 shrink-0">
                    <span className={`text-xs font-semibold ${active ? "text-[#6B9FD4]" : "text-muted-foreground/40"}`}>
                      {active ? "Aktif" : "Kosong"}
                    </span>
                    {active && (
                      <>
                        <span className="font-mono text-xs font-bold text-[#6B9FD4] bg-[#4A7FC1]/10 px-2 py-0.5 rounded-lg border border-[#4A7FC1]/20"
                          style={{ textShadow: "0 0 8px rgba(107,159,212,0.3)" }}>
                          {machine.nomor_sisir_destiny || machine.id_sisir_terpasang}
                        </span>
                        {durasi && (
                          <span className="text-[10px] text-[#C9A227] flex items-center gap-1">
                            <Clock className="w-3 h-3" />{durasi}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Machine Detail Dialog ── */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!actionLoading) setIsDetailOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 bg-card">
          {selectedMachine && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${hasActiveReed(selectedMachine) ? "bg-[#6B9FD4] shadow-[0_0_8px_rgba(107,159,212,0.8)]" : "bg-muted-foreground/30"}`} />
                  <DialogTitle>Mesin {selectedMachine.nomer_mesin}</DialogTitle>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(selectedMachine)}
                    className="h-8 gap-1 text-xs border-[#C9A227]/50 text-[#C9A227] hover:bg-[#C9A227]/10 transition-all">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </DialogHeader>

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-3 bg-muted/20 border border-border/40 p-3 rounded-xl text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Jenis</p>
                  <p className="font-medium">{selectedMachine.jenis_mesin || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">SN Mesin</p>
                  <p className="font-medium">{String(selectedMachine.sn_mesin) || "-"}</p>
                </div>
                <div className="col-span-2 border-t border-border/40 pt-2 mt-1 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#5BA3BF]" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Posisi Gedung</p>
                    <p className="font-medium text-[#5BA3BF]">{selectedMachine.posisi_gedung || "-"}</p>
                  </div>
                </div>
                <div className="border-t border-border/40 pt-2 mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Sisir Terpasang</p>
                  <p className={`font-bold font-mono ${hasActiveReed(selectedMachine) ? "text-[#6B9FD4]" : "text-muted-foreground/50"}`}
                    style={hasActiveReed(selectedMachine) ? { textShadow: "0 0 8px rgba(107,159,212,0.3)" } : {}}>
                    {hasActiveReed(selectedMachine)
                      ? selectedMachine.nomor_sisir_destiny || selectedMachine.id_sisir_terpasang
                      : "—"}
                  </p>
                </div>
                <div className="border-t border-border/40 pt-2 mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Durasi Pasang</p>
                  <p className="font-medium text-[#C9A227]">
                    {selectedMachine.durasi_pakai
                      ? selectedMachine.durasi_pakai
                      : selectedMachine.tanggal_pasang
                        ? calculateDuration(selectedMachine.tanggal_pasang)
                        : "-"}
                  </p>
                  {selectedMachine.tanggal_pasang && (
                    <p className="text-xs text-muted-foreground">{formatDate(selectedMachine.tanggal_pasang)}</p>
                  )}
                </div>
              </div>

              {/* Non-admin notice */}
              {!isAdmin && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Login sebagai Admin untuk melakukan aksi pasang/lepas sisir.
                </div>
              )}

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex gap-2">
                  {!hasActiveReed(selectedMachine) ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={actionLoading}>
                          <ArrowRightCircle className="mr-2 w-4 h-4" /> Pasang Sisir
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl border-border/60 bg-card">
                        <DialogHeader>
                          <DialogTitle>Pasang Sisir ke {selectedMachine.nomer_mesin}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                              Pilih Sisir <span className="normal-case text-muted-foreground/60">(Gudang & Riching)</span>
                            </Label>
                            <ReedCombobox
                              reeds={availableReeds}
                              value={installData.id_sisir_terpasang}
                              onChange={(id) => setInstallData({ ...installData, id_sisir_terpasang: id })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nama Mekanik</Label>
                            <Input
                              value={installData.nama_mekanik}
                              onChange={(e) => setInstallData({ ...installData, nama_mekanik: e.target.value })}
                              placeholder="Nama Mekanik"
                              className="rounded-xl border-border/60"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleInstallReed} disabled={actionLoading} className="w-full sm:w-auto">
                            {actionLoading ? "Memproses..." : "Konfirmasi Pasang"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="flex-1" disabled={actionLoading}>
                          <ArrowDownCircle className="mr-2 w-4 h-4" /> Lepas Sisir
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl border-border/60 bg-card">
                        <DialogHeader>
                          <DialogTitle>
                            Lepas Sisir {selectedMachine.nomor_sisir_destiny || selectedMachine.id_sisir_terpasang}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Kondisi Setelah Dilepas</Label>
                            <Select onValueChange={(v) => setRemoveData({ ...removeData, kondisi_sisir: v })}>
                              <SelectTrigger className="rounded-xl border-border/60">
                                <SelectValue placeholder="Pilih Kondisi" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border/60 bg-card">
                                <SelectItem value="BAIK">Baik → Kembali ke Gudang</SelectItem>
                                <SelectItem value="RUSAK">Rusak</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nama Mekanik</Label>
                            <Input
                              value={removeData.nama_mekanik}
                              onChange={(e) => setRemoveData({ ...removeData, nama_mekanik: e.target.value })}
                              placeholder="Nama Mekanik"
                              className="rounded-xl border-border/60"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="destructive" onClick={handleRemoveReed} disabled={actionLoading} className="w-full sm:w-auto">
                            {actionLoading ? "Memproses..." : "Konfirmasi Lepas"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="outline" onClick={() => generateMachineHistoryPDF(
                    selectedMachine.nomer_mesin, selectedMachine.jenis_mesin,
                    machineHistory, currentUser?.nama || "___________________"
                  )} className="border-border/60 hover:border-primary/50 hover:text-primary">
                    <FileText className="w-4 h-4 mr-2" /> PDF
                  </Button>
                </div>
              )}

              {!isAdmin && (
                <Button variant="outline" onClick={() => generateMachineHistoryPDF(
                  selectedMachine.nomer_mesin, selectedMachine.jenis_mesin,
                  machineHistory, currentUser?.nama || "___________________"
                )} className="border-border/60">
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              )}

              {/* Riwayat */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                  <History className="w-4 h-4" /> Riwayat Terakhir
                </h3>
                {machineHistoryDisplay.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat</p>
                ) : (
                  <div className="space-y-2">
                    {machineHistoryDisplay.map((h, i) => (
                      <div key={i}
                        className="list-item-animate text-sm border-l-2 pl-3 py-1.5 rounded-r-lg bg-muted/10"
                        style={{
                          animationDelay: `${i * 40}ms`,
                          borderColor: h.type === "PASANG" ? "#4A7FC1" : "#C0392B",
                        }}
                      >
                        <div className="flex justify-between font-medium">
                          <span className={h.type === "PASANG" ? "text-[#6B9FD4]" : "text-[#D95B4A]"}>
                            {h.type} — {h.nomor_sisir_destiny || h.id_sisir}
                          </span>
                          <span className="text-muted-foreground text-xs">{formatDate(h.tanggal)}</span>
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Mekanik: {h.nama_mekanik}{h.kondisi_sisir ? ` · ${h.kondisi_sisir}` : ""}
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

      {/* ── Edit Mesin Dialog ── */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!actionLoading) setIsEditOpen(open); }}>
        <DialogContent className="rounded-2xl border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>Edit Data Mesin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nama / Nomor Mesin</Label>
              <Input
                value={editMachineData.nomer_mesin}
                onChange={(e) => setEditMachineData({ ...editMachineData, nomer_mesin: e.target.value })}
                placeholder="Contoh: AC-01"
                className="rounded-xl border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Posisi Gedung / Lokasi</Label>
              <Input
                value={editMachineData.posisi_gedung}
                onChange={(e) => setEditMachineData({ ...editMachineData, posisi_gedung: e.target.value })}
                placeholder="Contoh: SHED3.1"
                className="rounded-xl border-border/60"
              />
            </div>
            <div className="bg-muted/20 border border-border/40 p-3 rounded-xl text-xs text-muted-foreground space-y-1">
              <p><strong>Tipe Mesin:</strong> {selectedMachine?.jenis_mesin || "-"}</p>
              <p><strong>Serial Number:</strong> {String(selectedMachine?.sn_mesin || "-")}</p>
              <p className="text-[10px] text-[#C9A227] font-medium mt-1.5">
                * Tipe dan SN bersifat paten & tidak dapat diubah di sini.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={actionLoading}
              className="border-border/60">Batal</Button>
            <Button onClick={handleEditMachine} disabled={actionLoading}
              className="bg-[#C9A227] hover:bg-[#C9A227]/90 text-background">
              {actionLoading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}