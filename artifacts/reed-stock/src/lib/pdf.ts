import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CombinedHistory, MasterStok, HistoryPotong, HistoryRiching } from "./types";

// ─── Helper: Normalisasi Nomor Sisir Destiny ──────────────────────────────────
export const normalizeDestiny = (value?: string | null): string => {
  if (!value) return "";
  return value.trim().toUpperCase();
};

// ─── Helper: Format tanggal ISO → "17 Jun 2026" ──────────────────────────────
const formatTanggal = (str: string): string => {
  if (!str || str === "-") return "-";
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return str;
  }
};

// ─── Header Bersama ───────────────────────────────────────────────────────────
const addHeader = (doc: jsPDF, leftLine1: string, leftLine2: string) => {
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("PT. TRIPUTRA TEXTILE INDUSTRIES", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Weaving Reed Tracking System", 105, 25, { align: "center" });

  doc.setLineWidth(0.6);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(9);
  doc.text(leftLine1, 14, 37);
  doc.text(leftLine2, 14, 43);

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Tanggal Cetak: ${today}`, 196, 37, { align: "right" });
};

// ─── Footer + Tanda Tangan ────────────────────────────────────────────────────
const addSignatureFooter = (
  doc: jsPDF,
  operator: string = "___________________",
  finalYOverride?: number
) => {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Halaman ${i} dari ${pages}`, 196, 290, { align: "right" });
    doc.setTextColor(0, 0, 0);

    if (i === pages) {
      const finalY = finalYOverride ?? (doc as any).lastAutoTable?.finalY ?? 200;
      const sigY = Math.min(finalY + 20, 255);

      doc.setFontSize(9);
      doc.text(`Dilaporkan Oleh: ${operator}`, 30, sigY);
      doc.line(28, sigY + 16, 90, sigY + 16);

      doc.text("Diketahui Oleh: ___________________", 130, sigY);
      doc.line(128, sigY + 16, 190, sigY + 16);
    }
  }
};

// ─── PDF Laporan Mesin ────────────────────────────────────────────────────────
export const generateMachineHistoryPDF = (
  machineId: string,
  machineType: string,
  history: CombinedHistory[],
  operator: string = "___________________"
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, `No Mesin: ${machineId}`, `Jenis Mesin: ${machineType}`);

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Aktivitas", "ID Sisir", "Nomor Destiny", "Mekanik", "Kondisi"]],
    body: history.map((h) => [
      formatTanggal(h.tanggal),
      h.type,
      h.id_sisir || "-",
      normalizeDestiny(h.nomor_sisir_destiny) || "-",
      h.nama_mekanik || "-",
      h.kondisi_sisir || "-",
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 18 },
    },
  });

  addSignatureFooter(doc, operator);
  doc.save(`Laporan_Mesin_${machineId}.pdf`);
};

// ─── PDF Laporan Sisir ────────────────────────────────────────────────────────
// Menggabungkan history PASANG/LEPAS + RICHING + POTONG dalam satu tabel
// diurutkan berdasarkan tanggal descending.
export const generateReedHistoryPDF = (
  reedId: string,
  destiny: string,
  history: CombinedHistory[],
  operator: string = "___________________",
  historyPotong: HistoryPotong[] = [],
  historyRiching: HistoryRiching[] = []
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, `ID Sisir: ${reedId}`, `Nomor Destiny: ${normalizeDestiny(destiny) || "-"}`);

  // ── Gabungkan semua history menjadi satu array dengan format seragam ──
  type UnifiedRow = {
    tanggal: string;
    aktivitas: string;
    detail: string;       // nomor mesin / destiny perubahan / keterangan riching
    destiny: string;
    mekanik: string;
    keterangan: string;
  };

  const unified: UnifiedRow[] = [
    // PASANG & LEPAS
    ...history.map((h) => ({
      tanggal: h.tanggal,
      aktivitas: h.type,
      detail: h.nomor_mesin || "-",
      destiny: normalizeDestiny(h.nomor_sisir_destiny) || "-",
      mekanik: h.nama_mekanik || "-",
      keterangan: h.kondisi_sisir || "-",
    })),
    // RICHING
    ...historyRiching.map((h) => ({
      tanggal: h.tanggal_kirim,
      aktivitas: "RICHING",
      detail: "-",
      destiny: normalizeDestiny(h.nomor_sisir_destiny) || "-",
      mekanik: h.nama_operator || "-",
      keterangan: h.keterangan || "-",
    })),
    // POTONG
    ...historyPotong.map((h) => ({
      tanggal: h.tanggal_potong,
      aktivitas: "POTONG",
      detail: `${normalizeDestiny(h.destiny_sebelum)} → ${normalizeDestiny(h.destiny_sesudah)}`,
      destiny: normalizeDestiny(h.destiny_sesudah) || "-",
      mekanik: h.nama_mekanik || "-",
      keterangan: h.keterangan || "-",
    })),
  ];

  // Urutkan tanggal descending (terbaru di atas)
  unified.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Aktivitas", "Detail", "Nomor Destiny", "Mekanik", "Keterangan"]],
    body: unified.map((r) => [
      formatTanggal(r.tanggal),
      r.aktivitas,
      r.detail,
      r.destiny,
      r.mekanik,
      r.keterangan,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 24 },  // Tanggal
      1: { cellWidth: 18 },  // Aktivitas
      2: { cellWidth: 42 },  // Detail (destiny sebelum→sesudah butuh ruang)
      3: { cellWidth: 28 },  // Nomor Destiny
      4: { cellWidth: 28 },  // Mekanik
      5: { cellWidth: 38 },  // Keterangan
    },
    // Warna baris per aktivitas
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const aktivitas = String(data.row.raw?.[1] || "");
      if (data.column.index === 1) {
        if (aktivitas === "PASANG")  { data.cell.styles.textColor = [22, 163, 74];   data.cell.styles.fontStyle = "bold"; }
        if (aktivitas === "LEPAS")   { data.cell.styles.textColor = [220, 38, 38];   data.cell.styles.fontStyle = "bold"; }
        if (aktivitas === "RICHING") { data.cell.styles.textColor = [147, 51, 234];  data.cell.styles.fontStyle = "bold"; }
        if (aktivitas === "POTONG")  { data.cell.styles.textColor = [234, 88, 12];   data.cell.styles.fontStyle = "bold"; }
      }
    },
  });

  addSignatureFooter(doc, operator);
  doc.save(`Laporan_Sisir_${reedId}.pdf`);
};

// ─── PDF Rekap Stok per Nomor Destiny → Supplier ─────────────────────────────
// Group by: destiny (primer) → supplier (sekunder)
// Kolom: Gudang | Riching | Dipakai | Rusak | Service | Total
export const generateStokRekapPDF = (
  stokList: MasterStok[],
  getStatus: (item: MasterStok) => string,
  operator: string = "___________________"
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ── Header ──
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("PT. TRIPUTRA TEXTILE INDUSTRIES", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Weaving Reed Tracking System", 105, 25, { align: "center" });
  doc.setLineWidth(0.6);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(9);
  doc.text("Laporan: Rekap Total Stok Sisir per Nomor Destiny & Supplier", 14, 37);
  doc.text(`Tanggal Cetak: ${today}`, 196, 37, { align: "right" });

  // ── Bangun struktur: Map<"destiny|||supplier", counts> ──
  type KondisiKey = "Gudang" | "Riching" | "Dipakai" | "Rusak" | "Service";
  const KONDISI: KondisiKey[] = ["Gudang", "Riching", "Dipakai", "Rusak", "Service"];

  type GroupEntry = {
    destiny: string;
    supplier: string;
    counts: Record<KondisiKey, number>;
  };

  const groupMap = new Map<string, GroupEntry>();

  stokList.forEach((item) => {
    const destiny  = normalizeDestiny(item.nomor_sisir_destiny) || "(Tidak Ada Destiny)";
    const supplier = (item.merk_supplier || "").trim() || "(Tidak Ada Supplier)";
    const key      = `${destiny}|||${supplier}`;
    const status   = getStatus(item) as KondisiKey;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        destiny,
        supplier,
        counts: { Gudang: 0, Riching: 0, Dipakai: 0, Rusak: 0, Service: 0 },
      });
    }

    const entry = groupMap.get(key)!;
    if (KONDISI.includes(status)) {
      entry.counts[status] += 1;
    }
  });

  // ── Urutkan: destiny ASC → supplier ASC ──
  const sorted = Array.from(groupMap.values()).sort((a, b) => {
    const destCmp = a.destiny.localeCompare(b.destiny, "id");
    if (destCmp !== 0) return destCmp;
    return a.supplier.localeCompare(b.supplier, "id");
  });

  // ── Hitung grand total ──
  const grandTotal: Record<KondisiKey, number> = {
    Gudang: 0, Riching: 0, Dipakai: 0, Rusak: 0, Service: 0,
  };
  sorted.forEach(({ counts }) => {
    KONDISI.forEach((k) => { grandTotal[k] += counts[k]; });
  });
  const grandTotalAll = KONDISI.reduce((s, k) => s + grandTotal[k], 0);

  // ── Baris tabel ──
  const tableBody = sorted.map(({ destiny, supplier, counts }) => {
    const total = KONDISI.reduce((s, k) => s + counts[k], 0);
    return [
      destiny,
      supplier,
      String(counts.Gudang),
      String(counts.Riching),
      String(counts.Dipakai),
      String(counts.Rusak),
      String(counts.Service),
      String(total),
    ];
  });

  // ── Render tabel ──
  autoTable(doc, {
    startY: 44,
    head: [[
      "Nomor Destiny",
      "Supplier",
      "Gudang",
      "Riching",
      "Dipakai",
      "Rusak",
      "Service",
      "Total",
    ]],
    body: tableBody,
    foot: [[
      "TOTAL KESELURUHAN",
      "",
      String(grandTotal.Gudang),
      String(grandTotal.Riching),
      String(grandTotal.Dipakai),
      String(grandTotal.Rusak),
      String(grandTotal.Service),
      String(grandTotalAll),
    ]],
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    footStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 8,
      overflow: "linebreak",
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 42, halign: "left"   },  // Destiny
      1: { cellWidth: 48, halign: "left"   },  // Supplier
      2: { cellWidth: 16, halign: "center" },  // Gudang
      3: { cellWidth: 16, halign: "center" },  // Riching
      4: { cellWidth: 16, halign: "center" },  // Dipakai
      5: { cellWidth: 16, halign: "center" },  // Rusak
      6: { cellWidth: 16, halign: "center" },  // Service
      7: { cellWidth: 14, halign: "center", fontStyle: "bold" },  // Total
    },
    // Warna angka per kondisi
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const val = Number(data.cell.raw);
      if (val <= 0) return;
      // Gudang (2) → biru
      if (data.column.index === 2) { data.cell.styles.textColor = [37, 99, 235];   data.cell.styles.fontStyle = "bold"; }
      // Riching (3) → ungu
      if (data.column.index === 3) { data.cell.styles.textColor = [147, 51, 234];  data.cell.styles.fontStyle = "bold"; }
      // Dipakai (4) → hijau
      if (data.column.index === 4) { data.cell.styles.textColor = [22, 163, 74];   data.cell.styles.fontStyle = "bold"; }
      // Rusak (5) → merah
      if (data.column.index === 5) { data.cell.styles.textColor = [220, 38, 38];   data.cell.styles.fontStyle = "bold"; }
      // Service (6) → kuning tua
      if (data.column.index === 6) { data.cell.styles.textColor = [161, 98, 7];    data.cell.styles.fontStyle = "bold"; }
    },
  });

  addSignatureFooter(doc, operator);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Rekap_Stok_Sisir_${dateStr}.pdf`);
};

// ─── PDF Daftar Sisir Rusak (untuk Approval Buang/Scrap) ─────────────────────
// Digunakan sebagai dokumen approval sebelum sisir dihapus permanen dari sistem.
export const generateSisirRusakPDF = (
  stokRusak: MasterStok[],
  operator: string = "___________________"
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });

  // ── Header ──
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("PT. TRIPUTRA TEXTILE INDUSTRIES", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Weaving Reed Tracking System", 105, 25, { align: "center" });
  doc.setLineWidth(0.6);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(9);
  doc.text("Laporan: Daftar Sisir Rusak — Permohonan Penghapusan (Buang/Scrap)", 14, 37);
  doc.text(`Tanggal Cetak: ${today}`, 196, 37, { align: "right" });

  // ── Keterangan approval ──
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Total sisir rusak: ${stokRusak.length} unit. Dokumen ini digunakan sebagai dasar persetujuan penghapusan data dari sistem.`,
    14, 43
  );
  doc.setTextColor(0, 0, 0);

  // ── Tabel ──
  autoTable(doc, {
    startY: 48,
    head: [["No", "ID Sisir", "Nomor Destiny", "Supplier", "Posisi Rak", "Kondisi", "Paraf"]],
    body: stokRusak.map((item, idx) => [
      String(idx + 1),
      item.id_sisir || "-",
      normalizeDestiny(item.nomor_sisir_destiny) || "-",
      item.merk_supplier || "-",
      item.posisi_rak || "-",
      item.kondisi_sisir || "RUSAK",
      "",  // kolom paraf kosong untuk tanda tangan manual
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [153, 27, 27],  // merah tua — penanda dokumen rusak/scrap
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [254, 242, 242],  // merah sangat muda
    },
    styles: { fontSize: 8, overflow: "linebreak", cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },  // No
      1: { cellWidth: 26, halign: "left"   },  // ID Sisir
      2: { cellWidth: 32, halign: "left"   },  // Nomor Destiny
      3: { cellWidth: 42, halign: "left"   },  // Supplier
      4: { cellWidth: 24, halign: "left"   },  // Posisi Rak
      5: { cellWidth: 32, halign: "left"   },  // Kondisi
      6: { cellWidth: 16, halign: "center" },  // Paraf
    },
  });

  addSignatureFooter(doc, operator);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Daftar_Sisir_Rusak_${dateStr}.pdf`);
};

// ─── PDF Live Tracking — Grid Kartu ──────────────────────────────────────────
export interface LiveTrackingRow {
  nomor_mesin: string;
  jenis_mesin?: string;
  posisi_gedung?: string;
  id_sisir: string;
  nomor_destiny: string;
  durasi: string;
  mekanik: string;
  aktif: boolean;
}

const drawMachineCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  row: LiveTrackingRow
) => {
  doc.setDrawColor(215, 215, 215);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(row.nomor_mesin || "-", x + 2, y + 4);

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  if (row.aktif) doc.setTextColor(22, 163, 74);
  else doc.setTextColor(150, 150, 150);
  doc.text(row.aktif ? "AKTIF" : "NON AKTIF", x + w - 2, y + 4, { align: "right" });

  doc.setDrawColor(232, 232, 232);
  doc.line(x + 1.5, y + 6, x + w - 1.5, y + 6);

  const colW = (w - 4) / 2;
  const detail: [string, string][] = [
    ["ID Sisir", row.id_sisir || "-"],
    ["Nomor Destiny", normalizeDestiny(row.nomor_destiny) || "-"],
    ["Durasi", row.durasi || "-"],
    ["Mekanik", row.mekanik || "-"],
  ];

  detail.forEach(([label, value], i) => {
    const fx = x + 2 + (i % 2) * colW;
    const fy = y + 10 + Math.floor(i / 2) * 6.2;

    doc.setFontSize(5.2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(label, fx, fy);

    doc.setFontSize(6.6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const valueText = doc.splitTextToSize(String(value || "-"), colW - 1)[0] || "-";
    doc.text(valueText, fx, fy + 3.1);
  });

  doc.setTextColor(0, 0, 0);
};

export const generateLiveTrackingPDF = (
  rows: LiveTrackingRow[],
  operator: string = "___________________"
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, "Laporan: Live Tracking Seluruh Mesin", `Total Mesin: ${rows.length}`);

  const marginX     = 12;
  const marginTop   = 47;
  const marginBottom = 16;
  const gap         = 3;
  const cols        = 3;
  const pageHeight  = 297;
  const boxWidth    = (210 - marginX * 2 - gap * (cols - 1)) / cols;
  const boxHeight   = 22;

  let x = marginX;
  let y = marginTop;
  let col = 0;
  let pageMaxY = marginTop;

  rows.forEach((row) => {
    if (y + boxHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = 16;
      col = 0;
      x = marginX;
      pageMaxY = y;
    }

    drawMachineCard(doc, x, y, boxWidth, boxHeight, row);
    pageMaxY = Math.max(pageMaxY, y + boxHeight);

    if (col === cols - 1) {
      col = 0;
      x = marginX;
      y += boxHeight + gap;
    } else {
      col += 1;
      x += boxWidth + gap;
    }
  });

  addSignatureFooter(doc, operator, pageMaxY);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Live_Tracking_${dateStr}.pdf`);
};