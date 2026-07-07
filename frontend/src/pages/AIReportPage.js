import { useState, useEffect, useRef } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Brain, Check, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export default function AIReportPage({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [pendingDeleteReportId, setPendingDeleteReportId] = useState(null);
  const [displayText, setDisplayText] = useState("");
  const [activeReport, setActiveReport] = useState(null);
  const typewriterRef = useRef(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports/weekly`, { credentials: "include" });
      const data = await res.json();
      setReports(data);
      if (data.length > 0 && !activeReport) {
        setActiveReport(data[0]);
        setDisplayText(data[0].content);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
    return () => { if (typewriterRef.current) clearInterval(typewriterRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateReport = async () => {
    setGenerating(true);
    setDisplayText("");
    try {
      const res = await fetch(`${API}/reports/weekly`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to generate");
      }
      const report = await res.json();
      setActiveReport(report);
      // Typewriter effect
      const content = report.content;
      let i = 0;
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      typewriterRef.current = setInterval(() => {
        i += 3;
        if (i < content.length) {
          setDisplayText(content.substring(0, i));
        } else {
          setDisplayText(content);
          clearInterval(typewriterRef.current);
          typewriterRef.current = null;
        }
      }, 10);
      toast.success("Reality check generated");
      fetchReports();
    } catch (err) {
      toast.error(err.message || "Failed to generate report");
    }
    setGenerating(false);
  };

  const selectReport = (report) => {
    setPendingDeleteReportId(null);
    setActiveReport(report);
    setDisplayText(report.content);
  };

  const deleteReport = async (reportId) => {
    const reportToDelete = reports.find((r) => r.report_id === reportId);
    if (!reportToDelete || deletingReportId) return;

    setDeletingReportId(reportId);
    try {
      const res = await fetch(`${API}/reports/weekly/${reportId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete report");
      }

      const nextReports = reports.filter((r) => r.report_id !== reportId);
      setReports(nextReports);
      if (activeReport?.report_id === reportId) {
        const nextActive = nextReports[0] || null;
        setActiveReport(nextActive);
        setDisplayText(nextActive?.content || "");
      }
      setPendingDeleteReportId(null);
      toast.success("Report deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete report");
    }
    setDeletingReportId(null);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppShell user={user} activePage="ai-report">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 md:w-6 md:h-6 text-[#00FF41]" />
            <div>
              <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
                Reality Report
              </h1>
              <p className="font-mono text-xs text-[#52525B] uppercase tracking-wider mt-1">
                AI-powered brutal honesty
              </p>
            </div>
          </div>
          <button
            onClick={generateReport}
            disabled={generating}
            data-testid="generate-report-btn"
            className="flex items-center justify-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 md:px-5 py-2.5 md:py-3 hover:bg-[#00CC33] hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] transition-colors duration-75 disabled:opacity-50 w-full sm:w-auto"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {generating ? "Analyzing..." : "Generate Report"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Report List */}
          <div className="lg:col-span-1 space-y-2 order-2 lg:order-1" data-testid="report-list">
            <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-3">
              Past Reports
            </p>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {reports.length === 0 && !loading && (
              <p className="font-mono text-xs text-[#333]">
                No reports yet. Generate your first one.
              </p>
            )}
            {reports.map((r) => (
              <div
                key={r.report_id}
                className={`group relative min-w-[220px] lg:min-w-0 w-full border transition-colors duration-75 shrink-0 ${
                  activeReport?.report_id === r.report_id
                    ? "border-[#00FF41] bg-[#0A0A0A]"
                    : "border-[#222] bg-transparent hover:border-[#444]"
                }`}
              >
                <button
                  onClick={() => selectReport(r)}
                  data-testid={`report-item-${r.report_id}`}
                  className="w-full text-left p-3 pr-10"
                >
                  <p className="font-mono text-xs text-[#A1A1AA]">
                    Week of {r.week_start}
                  </p>
                  <p className="font-mono text-[10px] text-[#52525B] mt-1">
                    {formatDate(r.generated_at)}
                  </p>
                  {r.data_summary && (
                    <p className="font-mono text-[10px] text-[#00FF41] mt-1">
                      {r.data_summary.total_productive_hours}h productive
                      {typeof r.data_summary.total_scheduled_hours === "number" && (
                        <span className="text-[#60A5FA]"> · {r.data_summary.total_scheduled_hours}h scheduled</span>
                      )}
                    </p>
                  )}
                </button>
                {pendingDeleteReportId === r.report_id ? (
                  <div className="absolute right-2 top-2 flex items-center gap-1 bg-[#050505] border border-[#333] p-0.5">
                    <button
                      type="button"
                      onClick={() => deleteReport(r.report_id)}
                      disabled={deletingReportId === r.report_id}
                      aria-label={`Confirm delete report from ${r.week_start}`}
                      title="Confirm delete"
                      data-testid={`confirm-delete-report-${r.report_id}`}
                      className="p-1 text-[#FF003C] hover:bg-[#FF003C]/10 transition-colors duration-75 disabled:opacity-50"
                    >
                      {deletingReportId === r.report_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteReportId(null)}
                      disabled={deletingReportId === r.report_id}
                      aria-label="Cancel delete"
                      title="Cancel"
                      data-testid={`cancel-delete-report-${r.report_id}`}
                      className="p-1 text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors duration-75 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteReportId(r.report_id)}
                    disabled={!!deletingReportId}
                    aria-label={`Delete report from ${r.week_start}`}
                    title="Delete report"
                    data-testid={`delete-report-${r.report_id}`}
                    className="absolute right-2 top-2 p-1.5 text-[#52525B] hover:text-[#FF003C] hover:bg-[#FF003C]/10 transition-colors duration-75 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            </div>
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3 bg-[#0A0A0A] border border-[#333] p-4 md:p-8 min-h-[300px] md:min-h-[400px] relative order-1 lg:order-2" data-testid="report-content">
            {activeReport && !generating && (
              <span
                data-testid="report-source-badge"
                title={
                  activeReport.source === "ai"
                    ? "Generated by Claude from your week's data"
                    : "Data-driven template — set ANTHROPIC_API_KEY on Vercel for real AI reports"
                }
                className={`absolute right-3 top-3 font-mono text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${
                  activeReport.source === "ai"
                    ? "text-[#00FF41] border-[#00FF41]/40"
                    : "text-[#52525B] border-[#333]"
                }`}
              >
                {activeReport.source === "ai" ? "AI" : "Offline summary"}
              </span>
            )}
            {generating && (
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 text-[#00FF41] animate-spin" />
                <span className="font-mono text-xs text-[#00FF41] uppercase tracking-wider">
                  Analyzing your data...
                </span>
              </div>
            )}
            {displayText ? (
              <div className="prose prose-invert max-w-none">
              <div className="font-mono text-sm text-[#EDEDED] leading-relaxed whitespace-pre-wrap">
                {displayText.split('\n').map((line, i) => {
                  // Stable key: combine index with report id so React reuses nodes during typewriter
                  const lineKey = `${activeReport?.report_id || "draft"}-line-${i}`;
                  // Inline markdown bold rendering helper
                  const renderInline = (text) => {
                    const parts = text.split(/(\*\*[^*]+\*\*)/g);
                    return parts.map((part, j) => {
                      const partKey = `${lineKey}-part-${j}`;
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={partKey} className="text-[#00FF41] font-bold">{part.slice(2, -2)}</strong>;
                      }
                      return <span key={partKey}>{part}</span>;
                    });
                  };

                  if (line.startsWith('# ')) {
                    return <h2 key={lineKey} className="font-heading text-xl font-bold text-[#00FF41] mt-6 mb-3 uppercase">{renderInline(line.replace('# ', ''))}</h2>;
                  }
                  if (line.startsWith('## ')) {
                    return <h3 key={lineKey} className="font-heading text-lg font-semibold text-[#EDEDED] mt-4 mb-2">{renderInline(line.replace('## ', ''))}</h3>;
                  }
                  if (line.startsWith('### ')) {
                    return <h4 key={lineKey} className="font-heading text-base font-semibold text-[#A1A1AA] mt-3 mb-1">{renderInline(line.replace('### ', ''))}</h4>;
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <div key={lineKey} className="flex gap-2 ml-2 my-1.5">
                        <span className="text-[#00FF41] shrink-0">&gt;</span>
                        <span>{renderInline(line.replace('- ', ''))}</span>
                      </div>
                    );
                  }
                  if (line.trim() === '') return <br key={lineKey} />;
                  return <p key={lineKey} className="my-1">{renderInline(line)}</p>;
                })}
                {generating && <span className="typewriter-cursor inline-block w-2">&nbsp;</span>}
              </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <Brain className="w-12 h-12 text-[#262626] mb-4" />
                <p className="font-mono text-sm text-[#333] uppercase tracking-wider">
                  No report selected
                </p>
                <p className="font-mono text-xs text-[#262626] mt-2">
                  Generate a weekly reality check to see your data analyzed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
