import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { LiveTracking, MasterStok } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Server, CheckCircle2, XCircle, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";

const statusLike = (value: string, ...keywords: string[]) =>
  keywords.some((k) => value?.trim().toLowerCase().includes(k.toLowerCase()));

interface Metrics {
  totalMesin: number;
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
        (m) => m.ID_sisir_terpasang && m.ID_sisir_terpasang.trim() !== ""
      ).length;
      const mesinKosong = totalMesin - mesinAktif;
      const stokGudang = masterStok.filter((s) =>
        statusLike(s["Status Saat Ini"], "gudang")
      ).length;
      const sisirRusak = masterStok.filter((s) =>
        statusLike(s["Status Saat Ini"], "rusak")
      ).length;

      setMetrics({ totalMesin, mesinAktif, mesinKosong, stokGudang, sisirRusak });
      setMachines(liveTracking);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
    { label: "Total Mesin", value: metrics?.totalMesin ?? 0, icon: Server, color: "text-blue-400", bg: "bg-blue-400/10" },
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

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
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
        <h2 className="text-base font-semibold tracking-tight mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
          Live Status Mesin
        </h2>
        {machines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <XCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Belum ada data mesin</p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {machines.map((machine) => {
              const hasReed = machine.ID_sisir_terpasang && machine.ID_sisir_terpasang.trim() !== "";
              return (
                <div
                  key={machine.Nomer_Mesin}
                  className={`rounded-xl border px-4 py-3 flex justify-between items-center gap-2 ${
                    hasReed ? "border-primary/40 bg-primary/5" : "border-border/50 bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasReed ? "bg-primary shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/40"}`} />
                    <div>
                      <p className="font-semibold text-sm leading-tight">{machine.Nomer_Mesin}</p>
                      <p className="text-xs text-muted-foreground">{machine.Jenis_Mesin}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sisir</p>
                    <p className={`font-mono text-xs font-semibold ${hasReed ? "text-primary" : "text-muted-foreground italic"}`}>
                      {hasReed ? machine.ID_sisir_terpasang : "Kosong"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
