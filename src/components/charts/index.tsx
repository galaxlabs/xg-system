import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
import type { Options } from "highcharts";

// ── Galaxy color palette for Highcharts ───────────────────────────────────
export const GALAXY_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
];

Highcharts.setOptions({
  colors: GALAXY_COLORS,
  chart: {
    style: { fontFamily: "'Inter', system-ui, sans-serif" },
    backgroundColor: "transparent",
    animation: { duration: 400 },
  },
  title: { style: { fontSize: "13px", fontWeight: "600", color: "#1e1b4b" } },
  subtitle: { style: { color: "#6b7280" } },
  legend: {
    itemStyle: { fontSize: "12px", fontWeight: "500", color: "#374151" },
    itemHoverStyle: { color: "#6366f1" },
  },
  xAxis: {
    labels: { style: { fontSize: "11px", color: "#6b7280" } },
    lineColor: "#e5e7eb",
    tickColor: "#e5e7eb",
  },
  yAxis: {
    labels: { style: { fontSize: "11px", color: "#6b7280" } },
    gridLineColor: "#f3f4f6",
    title: { style: { color: "#9ca3af", fontSize: "11px" } },
  },
  tooltip: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderRadius: 10,
    style: { color: "#f1f5f9", fontSize: "12px" },
    shadow: { color: "rgba(0,0,0,0.3)", offsetX: 2, offsetY: 4, opacity: 0.25, width: 12 },
  },
  credits: { enabled: false },
  plotOptions: {
    series: { animation: { duration: 500 } },
  },
});

// ── Common props ──────────────────────────────────────────────────────────
interface ChartProps {
  title?: string;
  height?: number;
  extraOptions?: Partial<Options>;
  onPointClick?: (category: string, value: number) => void;
}

// ── Column Chart ──────────────────────────────────────────────────────────
export function ColumnChart({
  title,
  categories,
  series,
  height = 280,
  stacked = false,
  extraOptions,
}: ChartProps & {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
  stacked?: boolean;
}) {
  const options: Options = {
    chart: { type: "column", height },
    title: { text: title ?? "" },
    xAxis: { categories, crosshair: true },
    yAxis: { title: { text: "" }, allowDecimals: false },
    plotOptions: {
      column: {
        borderRadius: 6,
        pointPadding: 0.15,
        groupPadding: 0.1,
        dataLabels: { enabled: false },
        stacking: stacked ? "normal" : undefined,
      },
    },
    series: series.map((s) => ({
      type: "column" as const,
      name: s.name,
      data: s.data,
      color: s.color,
    })),
    ...extraOptions,
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Line Chart ────────────────────────────────────────────────────────────
export function LineChart({
  title,
  categories,
  series,
  height = 280,
  extraOptions,
}: ChartProps & {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
}) {
  const options: Options = {
    chart: { type: "line", height },
    title: { text: title ?? "" },
    xAxis: { categories },
    yAxis: { title: { text: "" }, allowDecimals: false },
    plotOptions: {
      line: { marker: { radius: 4, symbol: "circle" }, lineWidth: 2.5 },
    },
    series: series.map((s) => ({
      type: "line" as const,
      name: s.name,
      data: s.data,
      color: s.color,
    })),
    ...extraOptions,
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Area Chart ────────────────────────────────────────────────────────────
export function AreaChart({
  title,
  categories,
  series,
  height = 280,
  extraOptions,
}: ChartProps & {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
}) {
  const options: Options = {
    chart: { type: "area", height },
    title: { text: title ?? "" },
    xAxis: { categories },
    yAxis: { title: { text: "" } },
    plotOptions: {
      area: {
        fillOpacity: 0.15,
        lineWidth: 2,
        marker: { radius: 3, symbol: "circle" },
        stacking: undefined,
      },
    },
    series: series.map((s) => ({
      type: "area" as const,
      name: s.name,
      data: s.data,
      color: s.color,
      fillColor: {
        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
        stops: [
          [0, (s.color ?? "#6366f1") + "55"],
          [1, (s.color ?? "#6366f1") + "00"],
        ],
      },
    })),
    ...extraOptions,
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Donut / Pie Chart ─────────────────────────────────────────────────────
export function DonutChart({
  title,
  data,
  height = 280,
  innerSize = "60%",
  extraOptions,
}: ChartProps & {
  data: { name: string; y: number; color?: string }[];
  innerSize?: string;
}) {
  const options: Options = {
    chart: { type: "pie", height },
    title: { text: title ?? "" },
    plotOptions: {
      pie: {
        innerSize,
        borderWidth: 2,
        borderColor: "#ffffff",
        dataLabels: { enabled: true, format: "{point.name}: {point.percentage:.1f}%", style: { fontSize: "11px" } },
      },
    },
    series: [{ type: "pie" as const, name: title ?? "Value", data }],
    ...extraOptions,
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Bar (horizontal) Chart ────────────────────────────────────────────────
export function BarChart({
  title,
  categories,
  series,
  height = 280,
  extraOptions,
  onPointClick,
}: ChartProps & {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
}) {
  const options: Options = {
    chart: { type: "bar", height },
    title: { text: title ?? "" },
    xAxis: { categories },
    yAxis: { title: { text: "" }, allowDecimals: false },
    plotOptions: {
      bar: {
        borderRadius: 4,
        dataLabels: { enabled: true, style: { fontSize: "10px" } },
        cursor: onPointClick ? "pointer" : undefined,
        point: {
          events: {
            click: onPointClick
              ? function (this: Highcharts.Point) {
                  const cat = String((this.category as unknown) ?? "");
                  onPointClick(cat, Number(this.y ?? 0));
                }
              : undefined,
          },
        },
      },
    },
    series: series.map((s) => ({
      type: "bar" as const,
      name: s.name,
      data: s.data,
      color: s.color,
    })),
    ...extraOptions,
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

// ── Gauge / Solid Gauge ───────────────────────────────────────────────────
export function GaugeCard({
  label,
  value,
  max,
  color = "#6366f1",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2 p-3">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="45" cy="45" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
        />
        <text x="45" y="50" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
          {pct}%
        </text>
      </svg>
      <span className="text-xs font-medium text-muted text-center">{label}</span>
      <span className="text-sm font-bold text-text">{value.toLocaleString()}</span>
    </div>
  );
}
