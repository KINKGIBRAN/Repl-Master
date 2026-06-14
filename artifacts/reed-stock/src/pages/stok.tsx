import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets, addRowToSheet, updateRowInSheet } from "@/lib/api";
import { MasterStok, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Settings, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReedHistoryPDF } from "@/lib/pdf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function StokPage() {
  const [stok, setStok] = useState<MasterStok[]>([]);
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Semua");
  
  // Selection
  const [selectedReed, setSelectedReed] = useState<MasterStok | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Forms
  const [newReed, setNewReed] = useState({ id: "", spesifikasi: "" });
  const [cutDimensi, setCutDimensi] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sheets = await fetchMultipleSheets(["MASTER_STOK", "HISTORY_PASANG", "HISTORY_LEPAS"]);
      const stokData = sheets["MASTER_STOK"];
      const hpData = sheets["HISTORY_PASANG"];
      const hlData = sheets["HISTORY_LEPAS"];
      setStok(stokData || []);
      
      const combined: CombinedHistory[] = [
        ...(hpData || []).map((h: any) => ({ ...h, type: "PASANG" })),
        ...(hlData || []).map((h: any) => ({ ...h, type: "LEPAS" }))
      ];
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);

      if (selectedReed) {
        const updated = stokData?.find((s: MasterStok) => s.id === selectedReed.id);
        if (updated) setSelectedReed(updated);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load stok");
    } finally {
      setLoading(false);
    }
  }, [selectedReed]);

  useEffect(() => {
    loadData();
  }, []);

  const handleAddReed = async () => {
    try {
      if (!newReed.id || !newReed.spesifikasi) {
        toast.error("ID dan Spesifikasi harus diisi");
        return;
      }
      await addRowToSheet("MASTER_STOK", {
        ...newReed,
        status: "Gudang"
      });
      toast.success("Sisir berhasil ditambahkan");
      setNewReed({ id: "", spesifikasi: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleService = async () => {
    if (!selectedReed) return;
    try {
      await updateRowInSheet("MASTER_STOK", "id", selectedReed.id, {
        status: "Di Supplier"
      });
      toast.success("Status diubah ke Service Supplier");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePotong = async () => {
    if (!selectedReed) return;
    if (!cutDimensi) {
      toast.error("Isi dimensi baru");
      return;
    }
    try {
      await updateRowInSheet("MASTER_STOK", "id", selectedReed.id, {
        spesifikasi: cutDimensi
      });
      toast.success("Spesifikasi berhasil diupdate");
      setCutDimensi("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredStok = filter === "Semua" ? stok : stok.filter(s => s.status === filter);
  const reedHistory = historyData.filter(h => h.id_sisir === selectedReed?.id);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Gudang': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'Dipakai': return 'bg-primary/20 text-primary border-primary/50';
      case 'Rusak': return 'bg-destructive/20 text-destructive border-destructive/50';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Master Stok</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Tambah Stok</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Sisir Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>ID Sisir</Label>
                <Input value={newReed.id} onChange={e => setNewReed({...newReed, id: e.target.value})} placeholder="Contoh: S-100" />
              </div>
              <div className="space-y-2">
                <Label>Spesifikasi (Density x Panjang x Tinggi)</Label>
                <Input value={newReed.spesifikasi} onChange={e => setNewReed({...newReed, spesifikasi: e.target.value})} placeholder="Contoh: 100 x 190 x 12" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddReed}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="Semua" value={filter} onValueChange={setFilter}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="Semua">Semua</TabsTrigger>
          <TabsTrigger value="Gudang">Gudang</TabsTrigger>
          <TabsTrigger value="Dipakai">Dipakai</TabsTrigger>
          <TabsTrigger value="Rusak">Rusak</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : filteredStok.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">Tidak ada data untuk filter ini.</div>
      ) : (
        <div className="grid gap-3 grid-cols-1">
          {filteredStok.map((item) => (
            <div 
              key={item.id}
              onClick={() => { setSelectedReed(item); setIsDetailOpen(true); }}
              className="bg-card border border-border p-4 rounded-lg cursor-pointer hover:border-primary transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-lg">{item.id}</div>
                <div className="text-sm text-muted-foreground">{item.spesifikasi}</div>
              </div>
              <Badge variant="outline" className={getStatusColor(item.status)}>{item.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Reed Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {selectedReed && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <DialogTitle className="text-xl">Detail Sisir {selectedReed.id}</DialogTitle>
                  <Badge variant="outline" className={getStatusColor(selectedReed.status)}>{selectedReed.status}</Badge>
                </div>
              </DialogHeader>
              
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <div className="text-xs text-muted-foreground">Spesifikasi</div>
                <div className="font-medium text-lg">{selectedReed.spesifikasi}</div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Modifikasi / Service</h3>
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
                      <DialogHeader><DialogTitle>Potong Sisir {selectedReed.id}</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Spesifikasi Baru</Label>
                          <Input value={cutDimensi} onChange={e => setCutDimensi(e.target.value)} placeholder="Contoh: 100 x 180 x 12" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handlePotong}>Simpan Perubahan</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <Button variant="secondary" className="w-full mt-2" onClick={() => generateReedHistoryPDF(selectedReed.id, selectedReed.spesifikasi, reedHistory)}>
                  <FileText className="w-4 h-4 mr-2" /> Cetak PDF Riwayat
                </Button>
              </div>

              <div className="mt-6">
                <h3 className="font-bold mb-3">Riwayat Pemakaian</h3>
                {reedHistory.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">Belum ada riwayat pemakaian</div>
                ) : (
                  <div className="space-y-3">
                    {reedHistory.map(h => (
                      <div key={h.id_log} className="text-sm border-l-2 border-border pl-3 py-1">
                        <div className="flex justify-between font-medium">
                          <span>{h.type} pada Mesin {h.id_mesin}</span>
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