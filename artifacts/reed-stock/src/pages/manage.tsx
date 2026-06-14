import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet, deleteRowFromSheet } from "@/lib/api";
import { LiveTracking, MasterStok, HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, History, FileText, ArrowRightCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateMachineHistoryPDF } from "@/lib/pdf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ManagePage() {
  const [machines, setMachines] = useState<LiveTracking[]>([]);
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  
  // Selection
  const [selectedMachine, setSelectedMachine] = useState<LiveTracking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Forms
  const [newMachine, setNewMachine] = useState({ id_mesin: "", sn: "", jenis: "", gedung: "" });
  const [installData, setInstallData] = useState({ id_sisir: "", operator: "", catatan: "" });
  const [removeData, setRemoveData] = useState({ kondisi_akhir: "", operator: "", catatan: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sheets = await fetchMultipleSheets(["LIVE_TRACKING", "MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const trackData = sheets["LIVE_TRACKING"];
      const stokData = sheets["MASTER_STOK"];
      const hpData = sheets["HISTORY_PASANG"];
      const hlData = sheets["HISTORY_LEPAS"];
      setMachines(trackData || []);
      setStok(stokData || []);
      
      const combined: CombinedHistory[] = [
        ...(hpData || []).map((h: any) => ({ ...h, type: "PASANG" })),
        ...(hlData || []).map((h: any) => ({ ...h, type: "LEPAS" }))
      ];
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);
      
      // Update selected machine if it was open
      if (selectedMachine) {
        const updated = trackData?.find((m: LiveTracking) => m.id_mesin === selectedMachine.id_mesin);
        if (updated) setSelectedMachine(updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load machines");
    } finally {
      setLoading(false);
    }
  }, [selectedMachine]);

  useEffect(() => {
    loadData();
  }, []); // Only on mount

  const handleAddMachine = async () => {
    try {
      if (!newMachine.id_mesin || !newMachine.jenis) {
        toast.error("ID Mesin dan Jenis harus diisi");
        return;
      }
      await addRowToSheet("LIVE_TRACKING", {
        ...newMachine,
        id_sisir: "",
        status_mesin: "Kosong"
      });
      toast.success("Mesin berhasil ditambahkan");
      setNewMachine({ id_mesin: "", sn: "", jenis: "", gedung: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleInstallReed = async () => {
    if (!selectedMachine) return;
    if (!installData.id_sisir || !installData.operator) {
      toast.error("Pilih Sisir dan isi nama Operator");
      return;
    }
    
    try {
      const id_log = `PASANG-${Date.now()}`;
      const tanggal = new Date().toISOString();
      
      await updateRowInSheet("LIVE_TRACKING", "id_mesin", selectedMachine.id_mesin, {
        id_sisir: installData.id_sisir,
        status_mesin: "Aktif"
      });
      
      await updateRowInSheet("MASTER_STOK", "id", installData.id_sisir, {
        status: "Dipakai"
      });
      
      await addRowToSheet("HISTORY_PASANG", {
        id_log,
        id_mesin: selectedMachine.id_mesin,
        id_sisir: installData.id_sisir,
        operator: installData.operator,
        tanggal,
        catatan: installData.catatan
      });
      
      toast.success("Sisir berhasil dipasang");
      setInstallData({ id_sisir: "", operator: "", catatan: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveReed = async () => {
    if (!selectedMachine || !selectedMachine.id_sisir) return;
    if (!removeData.kondisi_akhir || !removeData.operator) {
      toast.error("Pilih Kondisi dan isi nama Operator");
      return;
    }
    
    try {
      const id_log = `LEPAS-${Date.now()}`;
      const tanggal = new Date().toISOString();
      const currentSisir = selectedMachine.id_sisir;
      
      await updateRowInSheet("LIVE_TRACKING", "id_mesin", selectedMachine.id_mesin, {
        id_sisir: "",
        status_mesin: "Kosong"
      });
      
      await updateRowInSheet("MASTER_STOK", "id", currentSisir, {
        status: removeData.kondisi_akhir === "BAIK" ? "Gudang" : "Rusak"
      });
      
      await addRowToSheet("HISTORY_LEPAS", {
        id_log,
        id_mesin: selectedMachine.id_mesin,
        id_sisir: currentSisir,
        operator: removeData.operator,
        tanggal,
        kondisi_akhir: removeData.kondisi_akhir,
        catatan: removeData.catatan
      });
      
      toast.success("Sisir berhasil dilepas");
      setRemoveData({ kondisi_akhir: "", operator: "", catatan: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const machineHistory = historyData.filter(h => h.id_mesin === selectedMachine?.id_mesin).slice(0, 10);
  const availableReeds = stok.filter(s => s.status === "Gudang");

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Mesin</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Mesin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Mesin Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>No Mesin</Label>
                <Input value={newMachine.id_mesin} onChange={e => setNewMachine({...newMachine, id_mesin: e.target.value})} placeholder="Contoh: M-01" />
              </div>
              <div className="space-y-2">
                <Label>S/N</Label>
                <Input value={newMachine.sn} onChange={e => setNewMachine({...newMachine, sn: e.target.value})} placeholder="Serial Number" />
              </div>
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Input value={newMachine.jenis} onChange={e => setNewMachine({...newMachine, jenis: e.target.value})} placeholder="Contoh: Air Jet Loom" />
              </div>
              <div className="space-y-2">
                <Label>Gedung</Label>
                <Input value={newMachine.gedung} onChange={e => setNewMachine({...newMachine, gedung: e.target.value})} placeholder="Contoh: Gedung A" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddMachine}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : machines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">Belum ada mesin. Tambahkan mesin pertama Anda.</div>
      ) : (
        <div className="grid gap-3 grid-cols-1">
          {machines.map((machine) => (
            <div 
              key={machine.id_mesin}
              onClick={() => { setSelectedMachine(machine); setIsDetailOpen(true); }}
              className="bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-lg">{machine.id_mesin}</div>
                <div className="text-sm text-muted-foreground">{machine.jenis} | Gedung {machine.gedung}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className={`text-sm font-medium ${machine.id_sisir ? "text-primary" : "text-destructive"}`}>
                  {machine.id_sisir ? "Aktif" : "Kosong"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Machine Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedMachine && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Detail Mesin {selectedMachine.id_mesin}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Jenis</div>
                  <div className="font-medium">{selectedMachine.jenis}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gedung</div>
                  <div className="font-medium">{selectedMachine.gedung}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Serial Number</div>
                  <div className="font-medium">{selectedMachine.sn || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sisir Terpasang</div>
                  <div className="font-medium">{selectedMachine.id_sisir || "Kosong"}</div>
                </div>
              </div>

              <div className="flex gap-2">
                {!selectedMachine.id_sisir ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                        <ArrowRightCircle className="mr-2 w-4 h-4" /> Pasang Sisir
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Pasang Sisir Baru</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Pilih Sisir (Dari Gudang)</Label>
                          <Select onValueChange={(v) => setInstallData({...installData, id_sisir: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Sisir" /></SelectTrigger>
                            <SelectContent>
                              {availableReeds.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.id} - {r.spesifikasi}</SelectItem>
                              ))}
                              {availableReeds.length === 0 && <SelectItem value="none" disabled>Tidak ada sisir di gudang</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Operator</Label>
                          <Input value={installData.operator} onChange={e => setInstallData({...installData, operator: e.target.value})} placeholder="Nama Operator" />
                        </div>
                        <div className="space-y-2">
                          <Label>Catatan (Opsional)</Label>
                          <Textarea value={installData.catatan} onChange={e => setInstallData({...installData, catatan: e.target.value})} />
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
                      <DialogHeader><DialogTitle>Lepas Sisir {selectedMachine.id_sisir}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Kondisi Akhir</Label>
                          <Select onValueChange={(v) => setRemoveData({...removeData, kondisi_akhir: v})}>
                            <SelectTrigger><SelectValue placeholder="Pilih Kondisi" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BAIK">Baik (Kembali ke Gudang)</SelectItem>
                              <SelectItem value="RUSAK">Rusak</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Operator</Label>
                          <Input value={removeData.operator} onChange={e => setRemoveData({...removeData, operator: e.target.value})} placeholder="Nama Operator" />
                        </div>
                        <div className="space-y-2">
                          <Label>Catatan (Opsional)</Label>
                          <Textarea value={removeData.catatan} onChange={e => setRemoveData({...removeData, catatan: e.target.value})} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleRemoveReed} variant="destructive">Konfirmasi Lepas</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                
                <Button variant="outline" onClick={() => generateMachineHistoryPDF(selectedMachine.id_mesin, selectedMachine.jenis, machineHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </Button>
              </div>

              <div className="mt-6">
                <h3 className="font-bold mb-3 flex items-center"><History className="w-4 h-4 mr-2" /> Riwayat Terakhir</h3>
                {machineHistory.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">Belum ada riwayat</div>
                ) : (
                  <div className="space-y-3">
                    {machineHistory.map(h => (
                      <div key={h.id_log} className="text-sm border-l-2 pl-3 py-1" style={{ borderColor: h.type === 'PASANG' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                        <div className="flex justify-between font-medium">
                          <span>{h.type} {h.id_sisir}</span>
                          <span className="text-muted-foreground text-xs">{new Date(h.tanggal).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="text-muted-foreground text-xs mt-1">Oleh: {h.operator} {h.kondisi_akhir ? `• ${h.kondisi_akhir}` : ''}</div>
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