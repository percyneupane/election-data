interface CountdownBarProps {
  elapsedMs: number;
  totalMs: number;
}

export function CountdownBar({ elapsedMs, totalMs }: CountdownBarProps): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));

  return (
    <div className="countdown-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="countdown-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
