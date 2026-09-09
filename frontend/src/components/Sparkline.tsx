// Renders exactly the points it's given -- no interpolation, no padding
// to a fixed count. If there are only 3 real data points, this draws 3
// points. Purely presentational; all values come from the caller.
export default function Sparkline({ values, width = 140, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) {
    return <div className="text-[11px] text-slate-600">No data yet</div>;
  }
  if (values.length === 1) {
    return (
      <svg width={width} height={height}>
        <circle cx={width / 2} cy={height / 2} r={2.5} fill="#818cf8" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke="#818cf8" strokeWidth={1.5} />
      {values.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 6) - 3;
        return <circle key={i} cx={x} cy={y} r={1.8} fill="#818cf8" />;
      })}
    </svg>
  );
}
