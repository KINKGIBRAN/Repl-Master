import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CombinedHistory } from "./types";

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
  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Tanggal Cetak: ${today}`, 196, 37, { align: "right" });
};

const addSignatureFooter = (doc: jsPDF, operator: string = "___________________") => {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Page numbers
    doc.setFontSize(8);
    doc.text(`Halaman ${i} dari ${pages}`, 196, 290, { align: "right" });

    // Signatures only on last page
    if (i === pages) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
      const sigY = Math.min(finalY + 20, 255);

      doc.setFontSize(9);
      doc.text(`Dilaporkan Oleh: ${operator}`, 30, sigY);
      doc.line(28, sigY + 16, 90, sigY + 16);

      doc.text("Diketahui Oleh: ___________________", 130, sigY);
      doc.line(128, sigY + 16, 190, sigY + 16);
    }
  }
};

export const generateMachineHistoryPDF = (
  machineId: string,
  machineType: string,
  history: CombinedHistory[]
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, `No Mesin: ${machineId}`, `Jenis Mesin: ${machineType}`);

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Aktivitas", "ID Sisir", "Nomor Destiny", "Mekanik", "Kondisi"]],
    body: history.map((h) => [
      h.tanggal,
      h.type,
      h.ID_Sisir,
      h.Nomor_sisir_Destiny || "-",
      h.Nama_Mekanik,
      h.Kondisi_SIsir || "-",
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 8, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 } },
  });

  addSignatureFooter(doc);
  doc.save(`Laporan_Mesin_${machineId}.pdf`);
};

export const generateReedHistoryPDF = (
  reedId: string,
  destiny: string,
  history: CombinedHistory[]
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  addHeader(doc, `ID Sisir: ${reedId}`, `Nomor Destiny: ${destiny}`);

  autoTable(doc, {
    startY: 50,
    head: [["Tanggal", "Aktivitas", "Nomor Mesin", "Nomor Destiny", "Mekanik", "Kondisi"]],
    body: history.map((h) => [
      h.tanggal,
      h.type,
      h.Nomor_Mesin,
      h.Nomor_sisir_Destiny || "-",
      h.Nama_Mekanik,
      h.Kondisi_SIsir || "-",
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 8, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 } },
  });

  addSignatureFooter(doc);
  doc.save(`Laporan_Sisir_${reedId}.pdf`);
};
