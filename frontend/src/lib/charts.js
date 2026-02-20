// Wrapper to avoid babel-metadata-plugin crash on recharts imports
// eslint-disable-next-line no-eval
const lib = eval('require')('recharts');
export const BarChart = lib.BarChart;
export const Bar = lib.Bar;
export const XAxis = lib.XAxis;
export const YAxis = lib.YAxis;
export const CartesianGrid = lib.CartesianGrid;
export const Tooltip = lib.Tooltip;
export const ResponsiveContainer = lib.ResponsiveContainer;
export const Legend = lib.Legend;
export const PieChart = lib.PieChart;
export const Pie = lib.Pie;
export const Cell = lib.Cell;
