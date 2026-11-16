interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  description: string;
  tooltip: string;
  icon: string;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'violet';
  context?: string;
  onClick?(): void;
}

export function DashboardKpiCard({ label, value, description, tooltip, icon, tone = 'blue', context, onClick }: DashboardKpiCardProps) {
  const content = <>
    <span className={`dashboard-kpi-icon ${tone}`}><i className={`pi ${icon}`} /></span>
    <span className="dashboard-kpi-copy">
      <span className="dashboard-kpi-label">{label}<i className="pi pi-info-circle" aria-hidden="true" /></span>
      <strong>{value}</strong>
      <small>{description}</small>
      {context && <em>{context}</em>}
    </span>
    {onClick && <i className="pi pi-arrow-right dashboard-kpi-action" />}
  </>;
  return onClick
    ? <button className="dashboard-kpi" onClick={onClick} data-pr-tooltip={tooltip}>{content}</button>
    : <article className="dashboard-kpi" data-pr-tooltip={tooltip}>{content}</article>;
}

