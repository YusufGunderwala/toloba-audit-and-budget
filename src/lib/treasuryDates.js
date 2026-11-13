const treasuryDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function treasuryDate(value = new Date()) {
  const parts = Object.fromEntries(treasuryDateFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function receiptDate(receipt) {
  return receipt.receipt_date || treasuryDate(receipt.created_at);
}

export function formatTreasuryDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}
