import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { LiveTracking, MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, History, FileText, ArrowRightCircle, ArrowDownCircle, AlertCircle, Search, Clock, MapPin, Pencil, Lock, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateMachineHistoryPDF } from "@/lib/pdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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

const isGudang = (s: MasterStok) => {
  const status = (s.status_saat_ini || "").trim().toLowerCase();
  const kondisi = (s.kondisi_sisir || "").trim().toLowerCase();
  return status.includes("gudang") && !kondisi.includes("rusak");
};

// ─── Searchable Reed Combobox ──────────────────────────────────────────────
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
  const selected = reeds.find((r) => r.id_sisir === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected
            ? `${selected.nomor_sisir_destiny || "-"} (${selected.id_sisir})`
            : "Ketik ID Sisir atau Nomor Destiny..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari ID Sisir / Nomor Destiny..." />
          <CommandList>
            <CommandEmpty>Tidak ada sisir tersedia di gudang.</CommandEmpty>
            <CommandGroup>
              {reeds.map((r) => {
                const id = r.id_sisir;
                const destiny = r.nomor_sisir_destiny || "";
                const kondisi = r.kondisi_sisir || "";
                return (
                  <CommandItem
                    key={id}
                    value={`${id} ${destiny}`}
                    onSelect={() => {
                      onChange(id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{destiny} <span className="text-muted-foreground">({id})</span></span>
                      {kondisi && <span className="text-xs text-muted-foreground">{kondisi}</span>}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ManagePage() {
  const { isAdmin } = useAuth();
  const [machines, setMachines] = useState<LiveTracking[]>([]);
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      await addRowToSheet("LIVE_TRACKING", {
        ...newMachine,
        id_sisir_terpasang: "-",
        nomor_sisir_destiny: "-",
        tanggal_pasang: null,
      });
      toast.success("Mesin berhasil ditambahkan");
      setNewMachine({ nomer_mesin: "", sn_mesin: "", jenis_mesin: "", posisi_gedung: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditMachine = async () => {
    if (!selectedMachine) return;
    if (!editMachineData.nomer_mesin.trim()) {
      toast.error("Nama/Nomor Mesin tidak boleh kosong");
      return;
    }
    try {
      setMachines((prev) =>
        prev.map((m) =>
          m.nomer_mesin === selectedMachine.nomer_mesin
            ? { ...m, nomer_mesin: editMachineData.nomer_mesin, posisi_gedung: editMachineData.posisi_gedung }
            : m
        )
      );

      await updateRowInSheet("LIVE_TRACKING", "nomer_mesin", selectedMachine.nomer_mesin, {
        nomer_mesin: editMachineData.nomer_mesin,
        posisi_gedung: editMachineData.posisi_gedung,
      });
      toast.success("Data mesin berhasil diperbarui");
      setIsEditOpen(false);
      loadData();
    } catch (err: any) {
      setMachines((prev) =>
        prev.map((m) =>
          m.nomer_mesin === editMachineData.nomer_mesin ? selectedMachine : m
        )
      );
      toast.error(err.message || "Gagal memperbarui data mesin");
    }
  };

  const openEditDialog = (machine: LiveTracking) => {
    setEditMachineData({
      nomer_mesin: machine.nomer_mesin || "",
      posisi_gedung: machine.posisi_gedung || "",
    });
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

    try {
      setMachines((prev) =>
        prev.map((m) =>
          m.nomer_mesin === selectedMachine.nomer_mesin
            ? { ...m, id_sisir_terpasang: installData.id_sisir_terpasang, nomor_sisir_destiny: nomorDestiny, tanggal_pasang: tanggal }
            : m
        )
      );

      setInstallData({ id_sisir_terpasang: "", nama_mekanik: "" });
      setIsDetailOpen(false);
      setSelectedMachine(null);

      await addRowToSheet("HISTORY_PASANG", {
        tanggal_ganti: tanggal,
        nomor_mesin: selectedMachine.nomer_mesin,
        id_sisir: installData.id_sisir_terpasang,
        nomor_sisir_destiny: nomorDestiny,
        nama_mekanik: installData.nama_mekanik,
      });

      toast.success("Sisir berhasil dipasang!");
      loadData();
    } catch (err: any) {
      setMachines((prev) =>
        prev.map((m) =>
          m.nomer_mesin === selectedMachine.nomer_mesin ? selectedMachine : m
        )
      );
      toast.error(err.message);
      loadData();
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

    try {
      setMachines((prev) =>
        prev.map((m) =>
          m.nomer_mesin === currentMesin
            ? { ...m, id_sisir_terpasang: "-", nomor_sisir_destiny: "-", tanggal_pasang: null }
            : m
        )
      );

      setIsDetailOpen(false);
      setSelectedMachine(null);
      setRemoveData({ kondisi_sisir: "", nama_mekanik: "" });

      await Promise.all([
        updateRowInSheet("LIVE_TRACKING", "nomer_mesin", currentMesin, {
          id_sisir_terpasang: "-",
          nomor_sisir_destiny: "-",
          tanggal_pasang: null,
        }),
        addRowToSheet("HISTORY_LEPAS", {
          tanggal_lepas: tanggal,
          nomor_mesin: currentMesin,
          id_sisir: currentSisir,
          nomor_sisir_destiny: currentDestiny,
          nama_mekanik: removeData.nama_mekanik,
          kondisi_sisir: removeData.kondisi_sisir,
        }),
      ]);

      toast.success("Sisir berhasil dilepas!");
      loadData();
    } catch (err: any) {
      setMachines((prev) =>
        prev.map((m) => (m.nomer_mesin === currentMesin ? selectedMachine : m))
      );
      toast.error(`Gagal melepas sisir: ${err.message}`);
      loadData();
    }
  };

  const filteredMachines = machines.filter((machine) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const nomerMesin = machine.nomer_mesin?.toLowerCase() || "";
    const nomorSisir = (machine.nomor_sisir_destiny || machine.id_sisir_terpasang || "").toLowerCase();
    const idSisir = (machine.id_sisir_terpasang || "").toLowerCase();
    const posisi = (machine.posisi_gedung || "").toLowerCase();
    return nomerMesin.includes(query) || nomorSisir.includes(query) || idSisir.includes(query) || posisi.includes(query);
  });

  const machineHistory = historyData
    .filter((h) => h.nomor_mesin === selectedMachine?.nomer_mesin)
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
        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Mesin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Mesin Baru</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>No Mesin</Label>
                  <Input value={newMachine.nomer_mesin} onChange={(e) => setNewMachine({ ...newMachine, nomer_mesin: e.target.value })} placeholder="Contoh: M-01" />
                </div>
                <div className="space-y-2">
                  <Label>SN Mesin</Label>
                  <Input value={newMachine.sn_mesin} onChange={(e) => setNewMachine({ ...newMachine, sn_mesin: e.target.value })} placeholder="Serial Number" />
                </div>
                <div className="space-y-2">
                  <Label>Posisi Gedung</Label>
                  <Input value={newMachine.posisi_gedung} onChange={(e) => setNewMachine({ ...newMachine, posisi_gedung: e.target.value })} placeholder="Contoh: Shed3.1" />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Mesin</Label>
                  <Input value={newMachine.jenis_mesin} onChange={(e) => setNewMachine({ ...newMachine, jenis_mesin: e.target.value })} placeholder="Contoh: PICANOL AJL" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddMachine} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">Simpan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          type="text"
          placeholder="Cari nomor mesin, ID sisir, atau gedung..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-12 h-10 rounded-xl"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium">
            Clear
          </button>
        )}
      </div>

      {filteredMachines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          {searchQuery ? "Tidak ditemukan." : "Belum ada mesin."}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredMachines.map((machine) => {
            const hasReed = machine.id_sisir_terpasang &&
                            machine.id_sisir_terpasang.trim() !== "" &&
                            machine.id_sisir_terpasang.trim() !== "-";
            const durasi = machine.durasi_pakai || calculateDuration(machine.tanggal_pasang || "");
            return (
              <div
                key={machine.nomer_mesin}
                onClick={() => { setSelectedMachine(machine); setIsDetailOpen(true); }}
                className="bg-card border border-border p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{machine.nomer_mesin}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {machine.jenis_mesin} · SN: {String(machine.sn_mesin) || "-"}
                  </div>
                  {machine.posisi_gedung && (
                    <div className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {machine.posisi_gedung}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-1 ml-2 shrink-0">
                  <div className={`text-sm font-semibold ${hasReed ? "text-primary" : "text-muted-foreground/60"}`}>
                    {hasReed ? "Aktif" : "Non Aktif"}
                  </div>
                  {hasReed && (
                    <>
                      <div className="font-mono text-xs font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {machine.nomor_sisir_destiny || machine.id_sisir_terpasang}
                      </div>
                      <div className="text-[10px] text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{durasi}</span>
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
                <DialogTitle>Mesin {selectedMachine.nomer_mesin}</DialogTitle>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(selectedMachine)}
                    className="h-8 gap-1 text-xs border-amber-500 text-amber-600 hover:bg-amber-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Data
                  </Button>
                )}
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg text-sm">
                <div><p className="text-xs text-muted-foreground">Jenis</p><p className="font-medium">{selectedMachine.jenis_mesin || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">SN Mesin</p><p className="font-medium">{String(selectedMachine.sn_mesin) || "-"}</p></div>
                <div className="col-span-2 border-t pt-2 mt-1 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Posisi Gedung</p>
                    <p className="font-medium text-emerald-600">{selectedMachine.posisi_gedung || "-"}</p>
                  </div>
                </div>
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs text-muted-foreground">Sisir Terpasang</p>
                  <p className="font-medium font-mono text-primary">
                    {selectedMachine.id_sisir_terpasang && selectedMachine.id_sisir_terpasang.trim() !== "-"
                      ? selectedMachine.nomor_sisir_destiny || selectedMachine.id_sisir_terpasang
                      : "Non Aktif"}
                  </p>
                </div>
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs text-muted-foreground">Durasi Pasang</p>
                  <p className="font-medium text-amber-500">
                    {selectedMachine.durasi_pakai
                      ? selectedMachine.durasi_pakai
                      : selectedMachine.tanggal_pasang
                        ? `${calculateDuration(selectedMachine.tanggal_pasang)}`
                        : "-"}
                  </p>
                  {selectedMachine.tanggal_pasang && (
                    <p className="text-xs text-muted-foreground">{formatDate(selectedMachine.tanggal_pasang)}</p>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Login sebagai Admin untuk melakukan aksi pasang/lepas sisir.
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-2">
                  {(!selectedMachine.id_sisir_terpasang || selectedMachine.id_sisir_terpasang.trim() === "" || selectedMachine.id_sisir_terpasang.trim() === "-") ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="flex-1">
                          <ArrowRightCircle className="mr-2 w-4 h-4" /> Pasang Sisir
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Pasang Sisir ke {selectedMachine.nomer_mesin}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Pilih Sisir (Stok Gudang)</Label>
                            <ReedCombobox
                              reeds={availableReeds}
                              value={installData.id_sisir_terpasang}
                              onChange={(id) => setInstallData({ ...installData, id_sisir_terpasang: id })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nama Mekanik</Label>
                            <Input value={installData.nama_mekanik} onChange={(e) => setInstallData({ ...installData, nama_mekanik: e.target.value })} placeholder="Nama Mekanik" />
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
                        <DialogHeader>
                          <DialogTitle>Lepas Sisir {selectedMachine.nomor_sisir_destiny || selectedMachine.id_sisir_terpasang}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Kondisi Sisir Setelah Dilepas</Label>
                            <Select onValueChange={(v) => setRemoveData({ ...removeData, kondisi_sisir: v })}>
                              <SelectTrigger><SelectValue placeholder="Pilih Kondisi" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BAIK">Baik → Kembali ke Gudang</SelectItem>
                                <SelectItem value="RUSAK">Rusak</SelectItem>
                                <SelectItem value="SERVICE SUPPLIER">Service Supplier</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Nama Mekanik</Label>
                            <Input value={removeData.nama_mekanik} onChange={(e) => setRemoveData({ ...removeData, nama_mekanik: e.target.value })} placeholder="Nama Mekanik" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="destructive" onClick={handleRemoveReed}>Konfirmasi Lepas</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  <Button variant="outline" onClick={() => generateMachineHistoryPDF(selectedMachine.nomer_mesin, selectedMachine.jenis_mesin, machineHistory)}>
                    <FileText className="w-4 h-4 mr-2" /> PDF
                  </Button>
                </div>
              )}

              {!isAdmin && (
                <Button variant="outline" onClick={() => generateMachineHistoryPDF(selectedMachine.nomer_mesin, selectedMachine.jenis_mesin, machineHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              )}

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
                          <span>{h.type} — {h.nomor_sisir_destiny || h.id_sisir}</span>
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

      {/* MODAL EDIT DATA MESIN */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Mesin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama / Nomor Mesin</Label>
              <Input
                value={editMachineData.nomer_mesin}
                onChange={(e) => setEditMachineData({ ...editMachineData, nomer_mesin: e.target.value })}
                placeholder="Contoh: AC-01"
              />
            </div>
            <div className="space-y-2">
              <Label>Posisi Gedung / Lokasi</Label>
              <Input
                value={editMachineData.posisi_gedung}
                onChange={(e) => setEditMachineData({ ...editMachineData, posisi_gedung: e.target.value })}
                placeholder="Contoh: SHED3.1"
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-xl text-xs text-muted-foreground space-y-1">
              <p><strong>Tipe Mesin:</strong> {selectedMachine?.jenis_mesin || "-"}</p>
              <p><strong>Serial Number:</strong> {String(selectedMachine?.sn_mesin || "-")}</p>
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