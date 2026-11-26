// Line chart of overall score across resume versions (plain SVG, no dependencies)
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '');

export default function ScoreChart({ history }) {
  const points = (history || [])
    .map((h) => ({
      label: `v${h.version_number}${h.created_at ? ` • ${fmt(h.created_at)}` : ''}`,
      score: Number(h.overall_score),
    }))
    .filter((p) => Number.isFinite(p.score));

  if (points.length === 0) return <p className="muted">No history yet.</p>;

  const W = 1000, H = 260, padL = 48, padR = 32, padT = 24, padB = 40, inset = 70;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i) => padL + inset + (points.length === 1 ? (innerW - 2 * inset) / 2 : (i * (innerW - 2 * inset)) / (points.length - 1));
  const y = (s) => padT + innerH - (s / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.score)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img"
         aria-label="Match score by resume version">
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text className="chart-text" x={padL - 8} y={y(t) + 4} textAnchor="end">{t}%</text>
        </g>
      ))}
      {points.length > 1 && <path className="chart-line" d={path} />}
      {points.map((p, i) => (
        <g key={i}>
          <circle className="chart-dot" cx={x(i)} cy={y(p.score)} r="5" />
          <text className="chart-value" x={x(i)} y={y(p.score) - 12} textAnchor="middle">{p.score}%</text>
          <text className="chart-text" x={x(i)} y={H - 12} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
