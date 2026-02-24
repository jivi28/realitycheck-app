import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-black border border-[#00FF41] px-4 py-3">
      <p className="font-mono text-xs text-[#A1A1AA] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-xs" style={{ color: p.color }}>
          {p.name}: {p.value}h
        </p>
      ))}
    </div>
  );
}

export default function WeeklyBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="font-mono text-sm text-[#262626]">No data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
        <XAxis
          dataKey="day_name"
          stroke="#333"
          tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
          axisLine={{ stroke: "#1A1A1A" }}
        />
        <YAxis
          stroke="#333"
          tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
          axisLine={{ stroke: "#1A1A1A" }}
          unit="h"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "10px", letterSpacing: "0.05em" }}
        />
        <Bar dataKey="productive_hours" name="Productive" fill="#00FF41" radius={[0, 0, 0, 0]} />
        <Bar dataKey="break_hours" name="Unaccounted" fill="#262626" radius={[0, 0, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
