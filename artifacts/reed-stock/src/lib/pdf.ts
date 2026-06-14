import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CombinedHistory } from './types';

export const generateMachineHistoryPDF = (machineId: string, machineType: string, history: CombinedHistory[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PT. TRIPUTRA TEXTILE INDUSTRIES', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Weaving Reed Tracking System', 105, 28, { align: 'center' });

  // Separator
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // Metadata
  doc.setFontSize(10);
  doc.text(`No Mesin: ${machineId}`, 14, 40);
  doc.text(`Jenis Mesin: ${machineType}`, 14, 46);
  
  const today = new Date().toLocaleDateString('id-ID');
  doc.text(`Tanggal Cetak: ${today}`, 196, 40, { align: 'right' });

  // Table
  const tableData = history.map(row => [
    new Date(row.tanggal).toLocaleDateString('id-ID'),
    row.type,
    row.id_sisir,
    row.operator,
    row.kondisi_akhir || '-',
    row.catatan || '-'
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['Tanggal', 'Aktivitas', 'ID Sisir', 'Operator', 'Kondisi', 'Catatan']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { top: 50 }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 52;
  const footerY = Math.max(finalY + 40, 250);

  doc.text('Dilaporkan Oleh:', 40, footerY);
  doc.line(30, footerY + 15, 80, footerY + 15);

  doc.text('Diketahui Oleh:', 150, footerY);
  doc.line(140, footerY + 15, 190, footerY + 15);

  // Page Numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Halaman ${i} dari ${pageCount}`, 196, 290, { align: 'right' });
  }

  doc.save(`History_Mesin_${machineId}.pdf`);
};

export const generateReedHistoryPDF = (reedId: string, spesifikasi: string, history: CombinedHistory[]) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PT. TRIPUTRA TEXTILE INDUSTRIES', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Weaving Reed Tracking System', 105, 28, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  doc.setFontSize(10);
  doc.text(`ID Sisir: ${reedId}`, 14, 40);
  doc.text(`Spesifikasi: ${spesifikasi}`, 14, 46);
  
  const today = new Date().toLocaleDateString('id-ID');
  doc.text(`Tanggal Cetak: ${today}`, 196, 40, { align: 'right' });

  const tableData = history.map(row => [
    new Date(row.tanggal).toLocaleDateString('id-ID'),
    row.type,
    row.id_mesin,
    row.operator,
    row.kondisi_akhir || '-',
    row.catatan || '-'
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['Tanggal', 'Aktivitas', 'Mesin', 'Operator', 'Kondisi', 'Catatan']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { top: 50 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 52;
  const footerY = Math.max(finalY + 40, 250);

  doc.text('Dilaporkan Oleh:', 40, footerY);
  doc.line(30, footerY + 15, 80, footerY + 15);

  doc.text('Diketahui Oleh:', 150, footerY);
  doc.line(140, footerY + 15, 190, footerY + 15);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Halaman ${i} dari ${pageCount}`, 196, 290, { align: 'right' });
  }

  doc.save(`History_Sisir_${reedId}.pdf`);
};