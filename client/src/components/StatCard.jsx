export default function StatCard({ label, value, accent = 'text-slate-800' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
