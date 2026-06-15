import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { LiveTracking, MasterStok } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Server, CheckCircle2, XCircle, PackageX, Calendar, Clock, User, X, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const statusLike = (value: string, ...keywords: string[]) =>
  keywords.some((k) => value?.trim().toLowerCase().includes(k.toLowerCase()));

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

interface Metrics {
  mesinAktif: number;
  mesinKosong: number;
  stokGudang: number;
  sisirRusak: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [machines, setMachines] = useState<LiveTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ pasang: any[]; lepas: any[] }>({ pasang: [], lepas: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["LIVE_TRACKING", "MASTER_STOK"]);
      const liveTracking: LiveTracking[] = (sheets["LIVE_TRACKING"] || []).filter(
        (m: LiveTracking) => m.Nomer_Mesin && m.Nomer_Mesin.trim() !== ""
      );
      const masterStok: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s["ID SISIR"] && s["ID SISIR"].trim() !== ""
      );

      const totalMesin = liveTracking.length;
      const mesinAktif = liveTracking.filter(
        (m) => m.ID_sisir_terpasang &&
               m.ID_sisir_terpasang.trim() !== "" &&
               m.ID_sisir_terpasang.trim() !== "-"
      ).length;
      const mesinKosong = totalMesin - mesinAktif;

      const stokGudang = masterStok.filter((s) =>
        statusLike(s["Status Saat Ini"], "gudang")
      ).length;
      const sisirRusak = masterStok.filter((s) =>
        statusLike(s["Status Saat Ini"], "rusak")
      ).length;

      setMetrics({ mesinAktif, mesinKosong, stokGudang, sisirRusak });
      setMachines(liveTracking);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMachineClick = async (nomerMesin: string) => {
    setSelectedMachine(nomerMesin);
    setLoadingHistory(true);
    try {
      const sheets = await fetchMultipleSheets(["HISTORY_PASANG", "HISTORY_LEPAS"]);
      const pasang = (sheets["HISTORY_PASANG"] || []).filter(
        (h: any) => h.Nomor_Mesin?.trim().toLowerCase() === nomerMesin.trim().toLowerCase()
      );
      const lepas = (sheets["HISTORY_LEPAS"] || []).filter(
        (h: any) => h.Nomor_Mesin?.trim().toLowerCase() === nomerMesin.trim().toLowerCase()
      );
      setHistoryData({ pasang, lepas });
    } catch (err) {
      console.error("Gagal memuat riwayat mesin", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredMachines = searchQuery.trim()
    ? machines.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.Nomer_Mesin?.toLowerCase().includes(q) ||
          m.ID_sisir_terpasang?.toLowerCase().includes(q) ||
          (m.Nomor_sisir_Destiny || m["Nomor sisir Destiny"] || "").toLowerCase().includes(q) ||
          m.Posisi_Gedung?.toLowerCase().includes(q)
        );
      })
    : machines;

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
          <div>
            <p className="font-semibold text-sm">Gagal memuat data</p>
            <p className="text-xs mt-0.5 text-destructive/80">{error}</p>
          </div>
        </div>
        <Button onClick={loadData} className="w-full">Coba Lagi</Button>
      </div>
    );
  }

  const summaryCards = [
    { label: "Mesin Aktif", value: metrics?.mesinAktif ?? 0, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Mesin Kosong", value: metrics?.mesinKosong ?? 0, icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Stok Gudang", value: metrics?.stokGudang ?? 0, icon: CheckCircle2, color: "text-cyan-400", bg: "bg-cyan-400/10" },
    { label: "Sisir Rusak", value: metrics?.sisirRusak ?? 0, icon: PackageX, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="p-4 space-y-6 pb-24">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
          PT. Triputra Textile Industries
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-3 grid-cols-2">
        {summaryCards.map((card) => (
          <Card key={card.label} className="bg-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
              <div className={`rounded-md p-1.5 ${card.bg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-3xl font-bold tracking-tight">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
            Live Status Mesin
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">{filteredMachines.length}/{machines.length}</span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            type="text"
            placeholder="Cari mesin, sisir, ID, atau gedung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-9 rounded-xl text-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
              ✕
            </button>
          )}
        </div>

        {filteredMachines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <XCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">{searchQuery ? "Tidak ditemukan" : "Belum ada data mesin"}</p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filteredMachines.map((machine) => {
              const hasReed = machine.ID_sisir_terpasang &&
                              machine.ID_sisir_terpasang.trim() !== "" &&
                              machine.ID_sisir_terpasang.trim() !== "-";
              const nomorSisirDisplay = machine.Nomor_sisir_Destiny || (machine as any)["Nomor sisir Destiny"] || machine.ID_sisir_terpasang;

              return (
                <div
                  key={machine.Nomer_Mesin}
                  onClick={() => handleMachineClick(machine.Nomer_Mesin)}
                  className={`rounded-xl border p-2 flex flex-col justify-between min-h-[90px] transition-all cursor-pointer hover:scale-[1.03] active:scale-95 duration-200 shadow-sm hover:shadow-md ${
                    hasReed ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card opacity-70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${hasReed ? "bg-primary shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/40"}`} />
                      <p className="font-bold text-xs tracking-tight truncate">{machine.Nomer_Mesin}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate opacity-60">
                      {machine.Jenis_Mesin?.split(" ")[0]}
                    </span>
                  </div>

                  <div className="mt-1 pt-1 border-t border-border/30 flex flex-col items-start">
                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider scale-90 origin-left">Sisir</span>
                    <p className={`font-mono text-[10px] font-semibold tracking-tight truncate w-full ${hasReed ? "text-primary" : "text-muted-foreground/60 italic"}`}>
                      {hasReed ? nomorSisirDisplay : "Kosong"}
                    </p>
                    {hasReed && machine.Durasi_Pakai && (
                      <p className="text-[9px] text-amber-500 flex items-center gap-0.5 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {machine.Durasi_Pakai}
                      </p>
                    )}
                    {hasReed && machine.Posisi_Gedung && (
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {machine.Posisi_Gedung}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedMachine && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Riwayat Mesin {selectedMachine}
                </h3>
                <p className="text-xs text-muted-foreground">Log pemasangan & pelepasan sisir</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedMachine(null)} className="rounded-full h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {loadingHistory ? (
                <div className="flex flex-col py-12 items-center justify-center gap-2">
                  <Spinner className="w-6 h-6 text-primary" />
                  <p className="text-xs text-muted-foreground">Menarik log dari Google Sheets...</p>
                </div>
              ) : historyData.pasang.length === 0 && historyData.lepas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="mx-auto mb-2 h-6 w-6 opacity-30" />
                  <p className="text-xs">Belum ada riwayat terekam.</p>
                </div>
              ) : (
                <>
                  {historyData.pasang.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1">
                        🟢 Riwayat Pasang Sisir
                      </h4>
                      <div className="space-y-1.5">
                        {historyData.pasang.map((log, index) => (
                          <div key={index} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1">
                            <div className="flex justify-between font-medium">
                              <span className="text-card-foreground">Ukuran: {log.Nomor_sisir_Destiny || "-"}</span>
                              <span className="text-muted-foreground font-mono text-[10px] flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formatDate(log.Tanggal_Ganti)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>ID: <strong className="font-mono">{log.ID_Sisir}</strong></span>
                              <span className="flex items-center gap-0.5"><User className="h-3 w-3" /> {log.Nama_Mekanik || "Mekanik"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {historyData.lepas.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold text-destructive uppercase tracking-wide flex items-center gap-1">
                        🔴 Riwayat Lepas Sisir
                      </h4>
                      <div className="space-y-1.5">
                        {historyData.lepas.map((log, index) => (
                          <div key={index} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1">
                            <div className="flex justify-between font-medium">
                              <span className="text-card-foreground">Ukuran: {log.Nomor_sisir_Destiny || "-"}</span>
                              <span className="text-muted-foreground font-mono text-[10px] flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formatDate(log.Tanggal_Lepas)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>ID: <strong className="font-mono">{log.ID_Sisir}</strong></span>
                              <span>Kondisi: <strong className={log.Kondisi_SIsir?.toLowerCase().includes("rusak") ? "text-destructive" : "text-yellow-500"}>{log.Kondisi_SIsir || "OK"}</strong></span>
                            </div>
                            {log.Nama_Mekanik && (
                              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                                <User className="h-3 w-3" /> {log.Nama_Mekanik}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-3 border-t border-border bg-muted/10 text-right">
              <Button size="sm" onClick={() => setSelectedMachine(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
