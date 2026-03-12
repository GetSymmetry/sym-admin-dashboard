interface HeatmapChartProps {
  data: { label: string; values: number[] }[];
  columnLabels: string[];
  maxValue?: number;
}

export function HeatmapChart({ data, columnLabels, maxValue }: HeatmapChartProps) {
  const max = maxValue || Math.max(...data.flatMap(r => r.values), 1);
  const getColor = (value: number) => {
    const intensity = Math.round((value / max) * 100);
    return `rgba(64, 119, 237, ${intensity / 100})`; // brand.blue with opacity
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-body-small">
        <thead>
          <tr>
            <th className="py-1 px-2 text-text-secondary text-left" />
            {columnLabels.map(l => (
              <th key={l} className="py-1 px-2 text-text-secondary text-center font-normal">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.label}>
              <td className="py-1 px-2 text-text-secondary whitespace-nowrap">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="py-1 px-2 text-center" style={{ backgroundColor: getColor(v) }}>
                  <span className="text-text-primary font-medium">{v}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
