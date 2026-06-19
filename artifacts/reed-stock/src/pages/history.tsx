import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { HistoryPasang, HistoryLepas, HistoryRiching, HistoryPotong, CombinedHistory } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterKey = "Semua" | "PASANG" | "LEPAS" | "RICHING" | "POTONG" | "SERVICE" | "SELESAI";

const formatDateTime = (str: string): string => {
  if (!str || str === "-") return "-";
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      hour12: false, timeZone: "Asia/Jakarta",
    }).replace("pukul", "·");
  } catch { return str; }
};

const getCategory = (item: CombinedHistory): FilterKey => {
  if (item.type === ("RICHING" as any)) return "RICHING";
  if (item.type === ("POTONG" as any))  return "POTONG";
  if (item.type === "PASANG") return "PASANG";
  const kondisi = (item.kondisi_sisir || "").toUpperCase();
  const mesin   = (item.nomor_mesin   || "").toUpperCase();
  if (kondisi === "KIRIM_SERVICE" || mesin.includes("DIKIRIM")) return "SERVICE";
  if (
    kondisi === "TERIMA_SERVICE" || kondisi === "BAIK" ||
    mesin.includes("DITERIMA") || mesin.includes("SELESAI PERBAIKI")
  ) return "SELESAI";
  return "LEPAS";
};

const categoryConfig: Record<string, {
  label: string; bg: string; text: string; border: string; dot: string;
}> = {
  PASANG:  { label: "PASANG",  bg: "bg-primary/20",     text: "text-primary",     border: "border-primary/40",     dot: "bg-primary"      },
  LEPAS:   { label: "LEPAS",   bg: "bg-destructive/20", text: "text-destructive", border: "border-destructive/40", dot: "bg-destructive"  },
  RICHING: { label: "RICHING", bg: "bg-purple-500/20",  text: "text-purple-400",  border: "border-purple-500/40",  dot: "bg-purple-400"   },
  POTONG:  { label: "POTONG",  bg: "bg-orange-500/20",  text: "text-orange-400",  border: "border-orange-500/40",  dot: "bg-orange-400"   },
  SERVICE: { label: "SERVICE", bg: "bg-yellow-500/20",  text: "text-yellow-400",  border: "border-yellow-500/40",  dot: "bg-yellow-400"   },
  SELESAI: { label: "DONE",    bg: "bg-blue-500/20",    text: "text-blue-400",    border: "border-blue-500/40",    dot: "bg-blue-400"     },
};

const TAB_ROWS: FilterKey[][] = [
  ["Semua", "PASANG", "LEPAS", "POTONG"],
  ["RICHING", "SERVICE", "SELESAI"],
];

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<CombinedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets([
        "HISTORY_PASANG",
        "HISTORY_LEPAS",
        "HISTORY_RICHING",
        "HISTORY_POTONG",
      ]);
      const hpData: HistoryPasang[]   = sheets["HISTORY_PASANG"]  || [];
      const hlData: HistoryLepas[]    = sheets["HISTORY_LEPAS"]   || [];
      const hrData: HistoryRiching[]  = sheets["HISTORY_RICHING"] || [];
      const hpotData: HistoryPotong[] = sheets["HISTORY_POTONG"]  || [];

      const combined: CombinedHistory[] = [
        ...hpData.map((h) => ({
          type: "PASANG" as const,
          nomor_mesin: h.nomor_mesin,
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_ganti,
          created_by: h.created_by,
        })),
        ...hlData.map((h) => ({
          type: "LEPAS" as const,
          nomor_mesin: h.nomor_mesin,
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_lepas,
          kondisi_sisir: h.kondisi_sisir,
          created_by: h.created_by,
        })),
        ...hrData.map((h) => ({
          type: "RICHING" as any,
          nomor_mesin: "-",
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.nomor_sisir_destiny,
          nama_mekanik: h.nama_operator,
          nama_operator: h.nama_operator,
          tanggal: h.tanggal_kirim,
          keterangan: h.keterangan,
          created_by: h.created_by,
        })),
        ...hpotData.map((h) => ({
          type: "POTONG" as any,
          nomor_mesin: "-",
          id_sisir: h.id_sisir,
          nomor_sisir_destiny: h.destiny_sesudah,
          nama_mekanik: h.nama_mekanik,
          tanggal: h.tanggal_potong,
          keterangan: h.keterangan,
          destiny_sebelum: h.destiny_sebelum,
          destiny_sesudah: h.destiny_sesudah,
          created_by: h.created_by,
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

  const filteredHistory = (() => {
    let list = historyData;
    if (filter !== "Semua") list = list.filter((h) => getCategory(h) === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h) =>
          h.nomor_mesin?.toLowerCase().includes(q) ||
          h.id_sisir?.toLowerCase().includes(q) ||
          h.nomor_sisir_destiny?.toLowerCase().includes(q) ||
          h.nama_mekanik?.toLowerCase().includes(q) ||
          (h as any).destiny_sebelum?.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  const counts: Record<FilterKey, number> = {
    Semua:   historyData.length,
    PASANG:  historyData.filter((h) => getCategory(h) === "PASANG").length,
    LEPAS:   historyData.filter((h) => getCategory(h) === "LEPAS").length,
    RICHING: historyData.filter((h) => getCategory(h) === "RICHING").length,
    POTONG:  historyData.filter((h) => getCategory(h) === "POTONG").length,
    SERVICE: historyData.filter((h) => getCategory(h) === "SERVICE").length,
    SELESAI: historyData.filter((h) => getCategory(h) === "SELESAI").length,
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          type="text"
          placeholder="Cari mesin, sisir, atau operator..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-10 rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
          >✕</button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="space-y-1">
        {TAB_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
            {row.map((tab) => {
              const isActive = filter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "flex flex-col items-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all duration-200 border active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary scale-[1.02]"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  <span>{tab === "SELESAI" ? "DONE" : tab}</span>
                  <span className={cn("text-[10px] font-bold", isActive ? "text-primary-foreground/80" : "text-primary")}>
                    {counts[tab]}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border">
          {searchQuery ? "Tidak ditemukan." : "Belum ada aktivitas."}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((item, i) => {
            const cat = getCategory(item);
            const cfg = categoryConfig[cat] ?? categoryConfig["LEPAS"];
            const isPotong  = cat === "POTONG";
            const isRiching = cat === "RICHING";
            const isPasang  = cat === "PASANG";

            return (
              <div
                key={i}
                className="list-item-animate bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDateTime(item.tanggal)}
                    </span>
                  </div>

                  {isPotong ? (
                    <p className="text-sm font-semibold font-mono">
                      {item.id_sisir}
                      <span className="text-muted-foreground font-normal mx-1 text-xs">·</span>
                      <span className="text-destructive/80 text-xs font-normal line-through">{item.destiny_sebelum}</span>
                      <span className="text-muted-foreground mx-1 text-xs">→</span>
                      <span className="text-primary text-xs font-normal">{item.destiny_sesudah}</span>
                    </p>
                  ) : isRiching ? (
                    <p className="text-sm font-semibold font-mono">
                      {item.id_sisir}
                      <span className="text-muted-foreground font-normal mx-1 text-xs">·</span>
                      <span className="text-muted-foreground font-sans font-normal text-xs">{item.nomor_sisir_destiny || "-"}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-semibold font-mono">
                      {item.id_sisir}
                      <span className="text-muted-foreground font-normal mx-1 text-xs">{isPasang ? "→" : "←"}</span>
                      <span className="text-muted-foreground font-sans font-normal text-xs">{item.nomor_mesin}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                    {!isPotong && item.nomor_sisir_destiny && (
                      <span>{item.nomor_sisir_destiny}</span>
                    )}
                    {item.nama_mekanik && item.nama_mekanik !== "-" && (
                      <span>· {item.nama_mekanik}</span>
                    )}
                    {(isRiching || isPotong) && item.keterangan && (
                      <span className="italic">· {item.keterangan}</span>
                    )}
                    {item.created_by && item.created_by !== "-" && (
                      <span className="text-primary/70 font-medium">· {item.created_by}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
