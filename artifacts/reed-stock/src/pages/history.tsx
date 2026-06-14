import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ArrowRightCircle, ArrowDownCircle, Settings } from "lucide-react";

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sheets = await fetchMultipleSheets(["HISTORY_PASANG", "HISTORY_LEPAS"]);
      const hpData = sheets["HISTORY_PASANG"];
      const hlData = sheets["HISTORY_LEPAS"];
      
      const combined: CombinedHistory[] = [
        ...(hpData || []).map((h: any) => ({ ...h, type: "PASANG" })),
        ...(hlData || []).map((h: any) => ({ ...h, type: "LEPAS" }))
      ];
      
      combined.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setHistoryData(combined);
    } catch (err: any) {
      toast.error(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEventIcon = (type: string, kondisi?: string) => {
    if (type === 'PASANG') return <ArrowRightCircle className="w-5 h-5 text-primary" />;
    if (kondisi === 'RUSAK') return <Settings className="w-5 h-5 text-blue-500" />;
    return <ArrowDownCircle className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
      
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-primary" /></div>
      ) : historyData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">Belum ada aktivitas.</div>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {historyData.map((item) => (
            <div key={item.id_log} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 shadow-sm">
                {getEventIcon(item.type, item.kondisi_akhir)}
              </div>
              
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card border border-border p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between space-x-2 mb-1">
                  <div className="font-bold text-sm">
                    {item.type === 'PASANG' ? 'INSTALLED' : 'REMOVED'}
                  </div>
                  <time className="text-xs font-medium text-muted-foreground">
                    {new Date(item.tanggal).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <div className="text-sm text-foreground mt-2">
                  <span className="font-mono text-primary">{item.id_sisir}</span> {item.type === 'PASANG' ? 'dipasang ke' : 'dilepas dari'} <span className="font-mono text-primary">{item.id_mesin}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2 flex flex-col gap-1">
                  <span>Operator: {item.operator}</span>
                  {item.kondisi_akhir && <span>Kondisi: {item.kondisi_akhir}</span>}
                  {item.catatan && <span className="italic">"{item.catatan}"</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}