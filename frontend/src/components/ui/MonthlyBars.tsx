/** Single-series monthly bar chart (attendance %). Title names the series. */
export function MonthlyBars({ data }: { data: { label: string; value: number | null }[] }) {
  const PLOT = 150; // px height of the plotting area
  return (
    <div className="pl-7 pr-1">
      <div className="relative" style={{ height: PLOT }}>
        {/* horizontal gridlines + y-axis labels */}
        {[100, 75, 50, 25, 0].map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 flex items-center"
            style={{ top: `${((100 - g) / 100) * PLOT}px` }}
          >
            <span className="absolute -left-7 -translate-y-1/2 text-[10px] tabular-nums text-muted/70">{g}</span>
            <div className={`w-full border-t ${g === 0 ? 'border-line' : 'border-line/40'}`} />
          </div>
        ))}
        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {data.map((d) => (
            <div key={d.label} className="group relative flex-1 h-full flex items-end justify-center">
              {/* faint full-height track so empty months read as "no data" */}
              <div className="absolute bottom-0 w-full max-w-[22px] h-full rounded-md bg-panel2/40" />
              <div
                className="relative w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-accent/70 to-accent transition-[height,filter] duration-150 group-hover:brightness-110"
                style={{ height: `${d.value ?? 0}%`, minHeight: d.value == null ? 0 : 3 }}
              />
              {/* hover tooltip */}
              <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                <div className="rounded-md bg-ink/95 border border-line px-2 py-1 text-[11px] whitespace-nowrap shadow-pop">
                  <span className="text-muted">{d.label}: </span>
                  <span className="font-semibold text-fg">{d.value == null ? 'no data' : `${d.value}%`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* x-axis labels */}
      <div className="flex gap-1.5 mt-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[10px] text-muted">{d.label}</div>
        ))}
      </div>
    </div>
  );
}
