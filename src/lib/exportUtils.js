import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Export Array of Objects to Excel Spreadsheet (.xlsx)
export function exportToExcel(data, fileName = 'Toloba_Lawazam_Report') {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Auto-fit columns
  const max_widths = Object.keys(data[0]).map(key => ({
    wch: Math.max(
      key.length + 3,
      ...data.map(row => (row[key] ? row[key].toString().length + 2 : 10))
    )
  }));
  worksheet['!cols'] = max_widths;

  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Export Audit or Financial Report to PDF
export function exportToPDF(title, columns, rows, fileName = 'Toloba_Report') {
  const doc = new jsPDF();
  
  // Title & Header
  doc.setFontSize(16);
  doc.setTextColor(10, 66, 39); // Toloba Dark Green
  doc.text('TOLOBA UL KULLIYAAT IL MUMINOON', 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(title, 14, 23);

  doc.setFontSize(9);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}`, 14, 29);

  // Table
  autoTable(doc, {
    startY: 34,
    head: [columns],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [16, 92, 56], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 245] },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  doc.save(`${fileName}_${new Date().toISOString().slice(0,10)}.pdf`);
}
