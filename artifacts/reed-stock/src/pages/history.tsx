import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { HistoryPasang, HistoryLepas, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ArrowRightCircle, ArrowDownCircle, Wrench, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["HISTORY_PASANG", "HISTORY_LEPAS"]);
      const hpData: HistoryPasang[] = sheets["HISTORY_PASANG"] || [];
      const hlData: HistoryLepas[] = sheets["HISTORY_LEPAS"] || [];

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
    } catch (err: any) {
      setError(err.message || "Gagal memuat history");
      toast.error(err.message || "Gagal memuat history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getBadge = (item: CombinedHistory) => {
    if (item.type === "PASANG") {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/40">INSTALLED</span>;
    }
    if (item.Kondisi_SIsir === "RUSAK") {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">SERVICED</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-destructive/20 text-destructive border border-destructive/40">REMOVED</span>;
  };

  const getIcon = (item: CombinedHistory) => {
    if (item.type === "PASANG") return <ArrowRightCircle className="w-5 h-5 text-primary" />;
    if (item.Kondisi_SIsir === "RUSAK") return <Wrench className="w-5 h-5 text-blue-400" />;
    return <ArrowDownCircle className="w-5 h-5 text-destructive" />;
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
      <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>

      {historyData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          Belum ada aktivitas tercatat.
        </div>
      ) : (
        <div className="space-y-3">
          {historyData.map((item, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
              data-testid={`row-history-${i}`}
            >
              <div className="mt-0.5 shrink-0">{getIcon(item)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  {getBadge(item)}
                  <span className="text-xs text-muted-foreground shrink-0">{item.tanggal}</span>
                </div>
                <p className="text-sm font-medium">
                  Sisir <span className="font-mono text-primary">{item.ID_Sisir}</span>
                  {" "}{item.type === "PASANG" ? "dipasang ke" : "dilepas dari"}{" "}
                  <span className="font-mono text-primary">{item.Nomor_Mesin}</span>
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {item.Nomor_sisir_Destiny && <p>Destiny: {item.Nomor_sisir_Destiny}</p>}
                  <p>Mekanik: {item.Nama_Mekanik}</p>
                  {item.Kondisi_SIsir && <p>Kondisi: {item.Kondisi_SIsir}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
