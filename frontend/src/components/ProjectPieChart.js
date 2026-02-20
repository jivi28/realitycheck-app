/* eslint-disable no-undef */
const React = require("react");
const Recharts = require("recharts");

const {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} = Recharts;

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload[0]) return null;
  const data = payload[0].payload;
  return React.createElement("div", { className: "bg-black border border-[#00FF41] px-4 py-3" },
    React.createElement("p", { className: "font-mono text-xs text-[#EDEDED]" }, data.project_name),
    React.createElement("p", { className: "font-mono text-xs text-[#00FF41]" }, data.hours, "h")
  );
}

function renderLabel({ project_name, percent }) {
  if (percent < 0.05) return null;
  return project_name + " " + (percent * 100).toFixed(0) + "%";
}

function ProjectPieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="font-mono text-sm text-[#262626]">No data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="seconds"
          nameKey="project_name"
          label={renderLabel}
          labelLine={false}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.project_color || "#00FF41"} stroke="#050505" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={function(value) {
            return React.createElement("span", {
              style: { fontFamily: "JetBrains Mono", fontSize: "10px", color: "#A1A1AA" }
            }, value);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

module.exports = ProjectPieChart;
module.exports.default = ProjectPieChart;
