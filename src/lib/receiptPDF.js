import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTreasuryDate, receiptDate } from './treasuryDates';

let branding;

export async function loadReceiptPDF() {
  branding ??= Promise.all(['/TolobaLogoAnand-transparent.png', '/esign.png'].map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Receipt image could not be loaded.');
    return new Uint8Array(await response.arrayBuffer());
  })).catch(error => {
    branding = undefined;
    throw error;
  });
  const [logo, signature] = await branding;
  return receipt => receiptPDF(receipt, logo, signature);
}

function receiptPDF(receipt, logo, signature) {
  const doc = new jsPDF();
  doc.setFillColor(16, 92, 56);
  doc.rect(0, 0, 210, 39, 'F');
  doc.setFillColor(255);
  doc.roundedRect(14, 8, 22, 23, 2, 2, 'F');
  doc.addImage(logo, 'PNG', 17, 11, 16, 17, 'logo', 'FAST');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TOLOBA UL KULLIYAAT IL MUMINOON', 42, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Anand Treasury Committee', 42, 25);
  doc.text(receipt.status === 'void' ? 'VOID RECEIPT' : 'OFFICIAL RECEIPT', 42, 33);

  const details = [
    ['Receipt number', receipt.receipt_no],
    ['Receipt date', formatTreasuryDate(receiptDate(receipt))],
    ['Received from', receipt.members?.name || 'Member'],
    ['ITS number', receipt.members?.its_number || '-'],
    ['Purpose', 'Lawzam collection'],
    ['Period', `${receipt.period_month} ${receipt.period_year}`],
    ['Payment mode', receipt.payment_mode],
    ...(receipt.transaction_id ? [['Transaction reference', receipt.transaction_id]] : []),
    ['Amount', `INR ${Number(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
  ];
  if (receipt.void_reason) details.push(['Void reason', receipt.void_reason]);
  autoTable(doc, {
    startY: 46,
    body: details,
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' } },
    styles: { fontSize: 11, cellPadding: 4 }
  });
  let footer = doc.lastAutoTable.finalY + 8;
  if (footer > 245) {
    doc.addPage();
    footer = 18;
  }
  doc.addImage(signature, 'PNG', 155, footer, 25, 25, 'signature', 'FAST');
  doc.setTextColor(30);
  doc.setFontSize(10);
  doc.text('Treasurer', 167.5, footer + 27, { align: 'center' });
  doc.text('Computer generated receipt. No seal required.', 14, footer + 27);
  return doc;
}
