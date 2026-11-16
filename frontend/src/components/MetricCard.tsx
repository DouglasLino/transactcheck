export function MetricCard({ label, value, note, icon, tone = 'blue' }: { label: string; value: string | number; note: string; icon: string; tone?: string }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon"><i className={`pi ${icon}`} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

