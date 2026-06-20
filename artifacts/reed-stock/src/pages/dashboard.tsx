import { useState, useEffect, useCallback } from "react";
import { fetchMultipleSheets } from "@/lib/api";
import { LiveTracking, MasterStok } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Server, CheckCircle2, XCircle, PackageX, Calendar, Clock, User, X, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const getEffectiveStatus = (item: MasterStok): string => {
  const status = (item.status_saat_ini || "").trim().toUpperCase();
  const kondisi = (item.kondisi_sisir || "").trim().toUpperCase();
  if (status.includes("DIPAKAI") || status.includes("PAKAI")) return "Dipakai";
  if (status.includes("SERVICE") || status.includes("REPAIR") || status.includes("SUPPLIER")) return "Service";
  if (status.includes("RUSAK") || kondisi.includes("RUSAK")) return "Rusak";
  if (status.includes("GUDANG")) return "Gudang";
  return status || "-";
};

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

const isActiveMachine = (m: LiveTracking) =>
  !!m.id_sisir_terpasang &&
  m.id_sisir_terpasang.trim() !== "" &&
  m.id_sisir_terpasang.trim() !== "-";

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
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ pasang: any[]; lepas: any[] }>({ pasang: [], lepas: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchMultipleSheets(["LIVE_TRACKING", "MASTER_STOK"]);
      const liveTracking: LiveTracking[] = (sheets["LIVE_TRACKING"] || []).filter(
        (m: LiveTracking) => m.nomer_mesin && m.nomer_mesin.trim() !== ""
      );
      const masterStok: MasterStok[] = (sheets["MASTER_STOK"] || []).filter(
        (s: MasterStok) => s.id_sisir && s.id_sisir.trim() !== ""
      );

      const totalMesin = liveTracking.length;
      const mesinAktif = liveTracking.filter(isActiveMachine).length;
      const mesinKosong = totalMesin - mesinAktif;
      const stokGudang = masterStok.filter((s) => getEffectiveStatus(s) === "Gudang").length;
      const sisirRusak = masterStok.filter((s) => getEffectiveStatus(s) === "Rusak").length;

      setMetrics({ mesinAktif, mesinKosong, stokGudang, sisirRusak });

      const sorted = [...liveTracking].sort((a, b) => {
        const aActive = isActiveMachine(a) ? 0 : 1;
        const bActive = isActiveMachine(b) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.nomer_mesin.localeCompare(b.nomer_mesin);
      });
      setMachines(sorted);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMachineClick = async (mesin: LiveTracking) => {
    setSelectedMachine(mesin.nomer_mesin);
    setModalVisible(true);
    setLoadingHistory(true);
    try {
      const sheets = await fetchMultipleSheets(["HISTORY_PASANG", "HISTORY_LEPAS"]);
      // ─── FIX: filter pakai sn_mesin sebagai primary match, fallback nomor_mesin ───
      const matchMachine = (h: any) =>
        mesin.sn_mesin
          ? h.sn_mesin === mesin.sn_mesin
          : h.nomor_mesin?.trim().toLowerCase() === mesin.nomer_mesin.trim().toLowerCase();
      const pasang = (sheets["HISTORY_PASANG"] || []).filter(matchMachine);
      const lepas = (sheets["HISTORY_LEPAS"] || []).filter(matchMachine);
      setHistoryData({ pasang, lepas });
    } catch (err) {
      console.error("Gagal memuat riwayat mesin", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedMachine(null), 250);
  };

  const filteredMachines = searchQuery.trim()
    ? machines.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.nomer_mesin?.toLowerCase().includes(q) ||
          m.id_sisir_terpasang?.toLowerCase().includes(q) ||
          (m.nomor_sisir_destiny || "").toLowerCase().includes(q) ||
          m.posisi_gedung?.toLowerCase().includes(q)
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

  /*
    DENIM PALETTE per card:
    Mesin Aktif  → #6B9FD4  washed denim blue
    Mesin Kosong → #C9A227  brass gold (kancing denim)
    Stok Gudang  → #5BA3BF  selvedge teal
    Sisir Rusak  → #D95B4A  selvedge red
  */
  const summaryCards = [
    {
      label: "Mesin Aktif",
      value: metrics?.mesinAktif ?? 0,
      icon: CheckCircle2,
      valueColor: "text-[#6B9FD4]",
      iconColor:  "text-[#6B9FD4]",
      iconBg:     "bg-[#6B9FD4]/10",
      borderGradient: "linear-gradient(180deg, rgba(107,159,212,0.8) 0%, rgba(107,159,212,0.05) 100%)",
    },
    {
      label: "Mesin Kosong",
      value: metrics?.mesinKosong ?? 0,
      icon: AlertCircle,
      valueColor: "text-[#C9A227]",
      iconColor:  "text-[#C9A227]",
      iconBg:     "bg-[#C9A227]/10",
      borderGradient: "linear-gradient(180deg, rgba(201,162,39,0.8) 0%, rgba(201,162,39,0.05) 100%)",
    },
    {
      label: "Stok Gudang",
      value: metrics?.stokGudang ?? 0,
      icon: CheckCircle2,
      valueColor: "text-[#5BA3BF]",
      iconColor:  "text-[#5BA3BF]",
      iconBg:     "bg-[#5BA3BF]/10",
      borderGradient: "linear-gradient(180deg, rgba(91,163,191,0.8) 0%, rgba(91,163,191,0.05) 100%)",
    },
    {
      label: "Sisir Rusak",
      value: metrics?.sisirRusak ?? 0,
      icon: PackageX,
      valueColor: "text-[#D95B4A]",
      iconColor:  "text-[#D95B4A]",
      iconBg:     "bg-[#D95B4A]/10",
      borderGradient: "linear-gradient(180deg, rgba(217,91,74,0.8) 0%, rgba(217,91,74,0.05) 100%)",
    },
  ];

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
          PT. Triputra Textile Industries
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2">
        {summaryCards.map((card, i) => (
          <div
            key={card.label}
            className="list-item-animate relative rounded-xl overflow-hidden bg-card border border-border/50 shadow-sm"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Gradient top-border strip — like a selvedge edge */}
            <div
              className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl"
              style={{ background: card.borderGradient }}
            />

            <div className="pt-4 px-4 pb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              <div className={`rounded-lg p-1.5 ${card.iconBg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className={`text-3xl font-bold tracking-tight ${card.valueColor}`}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6B9FD4] inline-block animate-pulse" />
            Live Status Mesin
          </h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border/60 text-muted-foreground tabular-nums">
            {filteredMachines.length}/{machines.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${
              searchFocused ? "text-primary" : "text-muted-foreground/60"
            }`}
          />
          <Input
            type="text"
            placeholder="Cari mesin, sisir, ID, atau gedung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`pl-9 pr-9 h-9 rounded-xl text-sm transition-all duration-200 ${
              searchFocused
                ? "ring-2 ring-primary/40 border-primary/50"
                : "border-border/50"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filteredMachines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <XCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">{searchQuery ? "Tidak ditemukan" : "Belum ada data mesin"}</p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filteredMachines.map((machine, i) => {
              const hasReed = isActiveMachine(machine);
              const nomorSisirDisplay = machine.nomor_sisir_destiny || machine.id_sisir_terpasang;

              return (
                <div
                  key={machine.nomer_mesin}
                  onClick={() => handleMachineClick(machine)}
                  className={`list-item-animate relative rounded-xl border p-2 flex flex-col justify-between min-h-[90px] cursor-pointer active:scale-95 hover:scale-[1.03] transition-all duration-200 overflow-hidden ${
                    hasReed
                      ? "border-[#4A7FC1]/50 shadow-[0_0_12px_rgba(74,127,193,0.15)] hover:shadow-[0_0_18px_rgba(74,127,193,0.25)]"
                      : "border-border/25 bg-[#0D1520]/80 shadow-none opacity-55"
                  }`}
                  style={{
                    animationDelay: `${Math.min(i * 20, 400)}ms`,
                    background: hasReed
                      ? "linear-gradient(135deg, rgba(74,127,193,0.14) 0%, rgba(74,127,193,0.04) 60%, rgba(17,30,46,1) 100%)"
                      : undefined,
                  }}
                >
                  {/* Active glow top-strip */}
                  {hasReed && (
                    <div className="absolute inset-x-0 top-0 h-[2px]"
                      style={{ background: "linear-gradient(90deg, rgba(107,159,212,0.9), rgba(107,159,212,0.1))" }}
                    />
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                          hasReed
                            ? "bg-[#6B9FD4] shadow-[0_0_8px_rgba(107,159,212,0.9)]"
                            : "bg-muted-foreground/20"
                        }`}
                      />
                      <p className={`font-bold text-xs tracking-tight truncate ${hasReed ? "text-foreground" : "text-muted-foreground/60"}`}>
                        {machine.nomer_mesin}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate opacity-50">
                      {machine.jenis_mesin?.split(" ")[0]}
                    </span>
                  </div>

                  {/* Center focal: nomor destiny — fokus utama */}
                  <div className="flex-1 flex items-center justify-center py-1.5">
                    <p
                      className={`font-mono font-bold text-center leading-tight break-all ${
                        hasReed
                          ? "text-[11px] text-[#6B9FD4]"
                          : "text-[11px] text-muted-foreground/25 italic"
                      }`}
                      style={hasReed ? { textShadow: "0 0 10px rgba(107,159,212,0.45)" } : {}}
                    >
                      {hasReed ? nomorSisirDisplay : "—"}
                    </p>
                  </div>

                  {/* Bottom row: gedung kiri | durasi kanan */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    {hasReed && machine.posisi_gedung ? (
                      <span className="text-[8px] text-muted-foreground/60 flex items-center gap-0.5 truncate">
                        <MapPin className="w-2 h-2 shrink-0" />
                        {machine.posisi_gedung}
                      </span>
                    ) : <span />}
                    {hasReed && machine.durasi_pakai ? (
                      <span className="text-[8px] text-[#C9A227] flex items-center gap-0.5 shrink-0 ml-auto">
                        <Clock className="w-2 h-2" />
                        {machine.durasi_pakai}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Riwayat Mesin */}
      {selectedMachine && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.70)",
            backdropFilter: "blur(4px)",
            animation: modalVisible
              ? "fadeIn 200ms cubic-bezier(0.4,0,0.2,1) forwards"
              : "fadeOut 200ms cubic-bezier(0.4,0,0.2,1) forwards",
          }}
          onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
        >
          <div
            className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            style={{
              animation: modalVisible
                ? "slideUp 250ms cubic-bezier(0.34,1.56,0.64,1) forwards"
                : "slideDown 200ms cubic-bezier(0.4,0,0.2,1) forwards",
            }}
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  Riwayat Mesin {selectedMachine}
                </h3>
                <p className="text-xs text-muted-foreground">Log pemasangan & pelepasan sisir</p>
              </div>
              <Button size="icon" variant="ghost" onClick={handleCloseModal} className="rounded-full h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {loadingHistory ? (
                <div className="flex flex-col py-12 items-center justify-center gap-2">
                  <Spinner className="w-6 h-6 text-primary" />
                  <p className="text-xs text-muted-foreground">Menarik log dari database...</p>
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
                      <h4 className="text-xs font-bold text-[#6B9FD4] uppercase tracking-wide flex items-center gap-1">
                        🔵 Riwayat Pasang Sisir
                      </h4>
                      <div className="space-y-1.5">
                        {historyData.pasang.map((log, index) => (
                          <div
                            key={index}
                            className="list-item-animate p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex justify-between font-medium">
                              <span className="text-card-foreground">Ukuran: {log.nomor_sisir_destiny || "-"}</span>
                              <span className="text-muted-foreground font-mono text-[10px] flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formatDate(log.tanggal_ganti)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>ID: <strong className="font-mono">{log.id_sisir}</strong></span>
                              <span className="flex items-center gap-0.5"><User className="h-3 w-3" /> {log.nama_mekanik || "Mekanik"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {historyData.lepas.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold text-[#D95B4A] uppercase tracking-wide flex items-center gap-1">
                        🔴 Riwayat Lepas Sisir
                      </h4>
                      <div className="space-y-1.5">
                        {historyData.lepas.map((log, index) => (
                          <div
                            key={index}
                            className="list-item-animate p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex justify-between font-medium">
                              <span className="text-card-foreground">Ukuran: {log.nomor_sisir_destiny || "-"}</span>
                              <span className="text-muted-foreground font-mono text-[10px] flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formatDate(log.tanggal_lepas)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>ID: <strong className="font-mono">{log.id_sisir}</strong></span>
                              <span>
                                Kondisi:{" "}
                                <strong className={log.kondisi_sisir?.toLowerCase().includes("rusak") ? "text-[#D95B4A]" : "text-[#C9A227]"}>
                                  {log.kondisi_sisir || "OK"}
                                </strong>
                              </span>
                            </div>
                            {log.nama_mekanik && (
                              <div className="text-muted-foreground text-[10px] flex items-center gap-1">
                                <User className="h-3 w-3" /> {log.nama_mekanik}
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
              <Button size="sm" onClick={handleCloseModal}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
