interface UsageBarProps {
  used: number;
  max: number;
}

export function UsageBar({ used, max }: UsageBarProps) {
  const pct = Math.min(100, (used / max) * 100);
  const color = pct >= 100 ? '#dc2626' : pct >= 66 ? '#f59e0b' : '#22c55e';

  return (
    <div className="usage-bar-wrap">
      <div className="usage-bar-label">
        {used} / {max} AI commands used today
      </div>
      <div className="usage-bar-track">
        <div
          className="usage-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
