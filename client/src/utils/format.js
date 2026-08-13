export function peso(amount) {
  const n = Number(amount || 0);
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
