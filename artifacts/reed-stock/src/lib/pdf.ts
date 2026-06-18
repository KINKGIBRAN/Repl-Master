import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CombinedHistory, MasterStok } from "./types";

// ─── Helper: Normalisasi Nomor Sisir Destiny (samakan X besar/kecil) ────────
// Memastikan "32x78x115" dan "32X78X115" dianggap SAMA — mencegah data
// pecah jadi 2 baris berbeda saat direkap/grouping di laporan.
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

    // Tanda tangan hanya di halaman terakhir
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
export const generateReedHistoryPDF = (
  reedId: string,
  destiny: string,
  history: CombinedHistory[],
  operator: string = "___________________"
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, `ID Sisir: ${reedId}`, `Nomor Destiny: ${normalizeDestiny(destiny) || "-"}`);

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Aktivitas", "Nomor Mesin", "Nomor Destiny", "Mekanik", "Kondisi"]],
    body: history.map((h) => [
      formatTanggal(h.tanggal),
      h.type,
      h.nomor_mesin || "-",
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
  doc.save(`Laporan_Sisir_${reedId}.pdf`);
};

// ─── PDF Rekap Stok per Nomor Destiny ─────────────────────────────────────────
//
// Struktur output:
//   Halaman 1 → Tabel ringkasan: tiap baris = 1 Nomor Destiny,
//               kolom = Gudang | Dipakai | Rusak | Service | Total
//   Halaman berikutnya → (tidak ada detail per ID, sesuai permintaan)
//
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
  doc.text("Laporan: Rekap Total Stok Sisir per Nomor Destiny", 14, 37);
  doc.text(`Tanggal Cetak: ${today}`, 196, 37, { align: "right" });

  // ── Bangun struktur: Map<destiny, { Gudang, Dipakai, Rusak, Service }> ──
  type KondisiKey = "Gudang" | "Dipakai" | "Rusak" | "Service";
  const KONDISI: KondisiKey[] = ["Gudang", "Dipakai", "Rusak", "Service"];

  const destinyMap = new Map<string, Record<KondisiKey, number>>();

  stokList.forEach((item) => {
    // Normalisasi: samakan X/x, kosong/null → "(Tidak Ada Destiny)"
    const destiny = normalizeDestiny(item.nomor_sisir_destiny) || "(Tidak Ada Destiny)";
    const status = getStatus(item) as KondisiKey;

    if (!destinyMap.has(destiny)) {
      destinyMap.set(destiny, { Gudang: 0, Dipakai: 0, Rusak: 0, Service: 0 });
    }

    const entry = destinyMap.get(destiny)!;
    if (KONDISI.includes(status)) {
      entry[status] += 1;
    }
  });

  // ── Urutkan destiny secara alfabetis ──
  const sortedDestinies = Array.from(destinyMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b, "id")
  );

  // ── Hitung total keseluruhan per kondisi ──
  const grandTotal: Record<KondisiKey, number> = { Gudang: 0, Dipakai: 0, Rusak: 0, Service: 0 };
  sortedDestinies.forEach(([, counts]) => {
    KONDISI.forEach((k) => { grandTotal[k] += counts[k]; });
  });
  const grandTotalAll =
    grandTotal.Gudang + grandTotal.Dipakai + grandTotal.Rusak + grandTotal.Service;

  // ── Baris tabel ──
  const tableBody = sortedDestinies.map(([destiny, counts]) => {
    const total = counts.Gudang + counts.Dipakai + counts.Rusak + counts.Service;
    return [
      destiny,
      String(counts.Gudang),
      String(counts.Dipakai),
      String(counts.Rusak),
      String(counts.Service),
      String(total),
    ];
  });

  // ── Render tabel utama ──
  autoTable(doc, {
    startY: 44,
    head: [
      [
        { content: "Nomor Destiny", rowSpan: 1 },
        { content: "Gudang",  rowSpan: 1 },
        { content: "Dipakai", rowSpan: 1 },
        { content: "Rusak",   rowSpan: 1 },
        { content: "Service", rowSpan: 1 },
        { content: "Total",   rowSpan: 1 },
      ],
    ],
    body: tableBody,
    foot: [
      [
        "TOTAL KESELURUHAN",
        String(grandTotal.Gudang),
        String(grandTotal.Dipakai),
        String(grandTotal.Rusak),
        String(grandTotal.Service),
        String(grandTotalAll),
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    footStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    styles: {
      fontSize: 9,
      overflow: "linebreak",
      cellPadding: 3,
    },
    columnStyles: {
      // Nomor Destiny — lebih lebar
      0: { cellWidth: 70, halign: "left" },
      // 4 kondisi — sama lebar, center
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
      // Total — sedikit lebih tebal
      5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
    },
    // Warnai kolom kondisi di body agar mudah dibaca
    didParseCell: (data) => {
      if (data.section === "body") {
        // Kolom Gudang (1) → biru muda
        if (data.column.index === 1 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = [37, 99, 235];
          data.cell.styles.fontStyle = "bold";
        }
        // Kolom Dipakai (2) → hijau
        if (data.column.index === 2 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        }
        // Kolom Rusak (3) → merah
        if (data.column.index === 3 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
        // Kolom Service (4) → kuning tua
        if (data.column.index === 4 && Number(data.cell.raw) > 0) {
          data.cell.styles.textColor = [161, 98, 7];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  addSignatureFooter(doc, operator);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Rekap_Stok_Sisir_${dateStr}.pdf`);
};

// ─── PDF Live Tracking — Grid Kartu (Seluruh Mesin) ──────────────────────────
//
// Setiap mesin ditampilkan sebagai 1 kartu kecil dalam grid 3 kolom (hemat kertas).
// Isi kartu: No Mesin, Status, ID Sisir, Nomor Destiny, Durasi Pasang, Mekanik.
//
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
  // Kotak pembatas kartu
  doc.setDrawColor(215, 215, 215);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  // No Mesin (kiri atas) + Status (kanan atas)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(row.nomor_mesin || "-", x + 2, y + 4);

  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  if (row.aktif) doc.setTextColor(22, 163, 74);
  else doc.setTextColor(150, 150, 150);
  doc.text(row.aktif ? "AKTIF" : "NON AKTIF", x + w - 2, y + 4, { align: "right" });

  // Garis pembatas
  doc.setDrawColor(232, 232, 232);
  doc.line(x + 1.5, y + 6, x + w - 1.5, y + 6);

  // Detail 2x2: ID Sisir | Nomor Destiny // Durasi Pasang | Mekanik
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

  const marginX = 12;
  const marginTop = 47;
  const marginBottom = 16;
  const gap = 3;
  const cols = 3;
  const pageHeight = 297;
  const boxWidth = (210 - marginX * 2 - gap * (cols - 1)) / cols;
  const boxHeight = 22;

  let x = marginX;
  let y = marginTop;
  let col = 0;
  let pageMaxY = marginTop;

  rows.forEach((row) => {
    // Pindah halaman jika kartu tidak akan muat
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

  // sigY dihitung dari posisi kartu terakhir di halaman terakhir,
  // bukan dari lastAutoTable (karena grid ini tidak memakai autoTable)
  addSignatureFooter(doc, operator, pageMaxY);

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan_Live_Tracking_${dateStr}.pdf`);
};