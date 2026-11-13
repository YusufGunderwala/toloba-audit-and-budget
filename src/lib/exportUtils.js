// Export Array of Objects to Excel Spreadsheet (.xlsx)
export async function exportToExcel(data, fileName = 'Toloba_Lawazam_Report') {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Auto-fit columns
  worksheet['!cols'] = Object.keys(data[0]).map(key => ({
    wch: data.reduce((width, row) => Math.max(width, Math.min(60, String(row[key] ?? '').length + 2)), key.length + 3)
  }));

  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Export Audit or Financial Report to PDF
export async function exportToPDF(title, columns, rows, fileName = 'Toloba_Report') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable')
  ]);
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
