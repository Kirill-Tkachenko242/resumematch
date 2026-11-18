// Line chart of overall score across resume versions (plain SVG, no dependencies)
export default function ScoreChart({ history }) {
  const points = (history || [])
    .map((h) => ({ label: `v${h.version_number}`, score: Number(h.overall_score) }))
    .filter((p) => Number.isFinite(p.score));

  if (points.length === 0) return <p>No history yet.</p>;

  const W = 480, H = 220, padL = 40, padR = 20, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i) => padL + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (s) => padT + innerH - (s / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.score)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 520 }} role="img"
         aria-label="Match score by resume version">
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e5e5e5" />
          <text x={padL - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#666">{t}</text>
        </g>
      ))}
      {points.length > 1 && <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" />}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r="4" fill="#4f46e5" />
          <text x={x(i)} y={y(p.score) - 9} fontSize="11" textAnchor="middle" fill="#333">{p.score}</text>
          <text x={x(i)} y={H - 12} fontSize="11" textAnchor="middle" fill="#666">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}