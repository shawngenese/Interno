interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipEntry[];
}

export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const hasLabel = label !== undefined && label !== null && label !== '';

  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-md">
      {hasLabel && <p className="mb-1.5 font-semibold text-foreground">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const name = entry.name ?? (entry.dataKey !== undefined ? String(entry.dataKey) : '');
          return (
            <li key={`${String(name)}-${index}`} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || 'var(--color-primary)' }}
                aria-hidden="true"
              />
              <span className="text-foreground">{String(name)}</span>
              <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
                {String(entry.value ?? '')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
