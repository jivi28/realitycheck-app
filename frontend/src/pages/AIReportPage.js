import { useState, useEffect } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AIReportPage({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [activeReport, setActiveReport] = useState(null);

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
      const interval = setInterval(() => {
        if (i <= content.length) {
          setDisplayText(content.substring(0, i));
          i += 3;
        } else {
          clearInterval(interval);
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
    setActiveReport(report);
    setDisplayText(report.content);
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
              <button
                key={r.report_id}
                onClick={() => selectReport(r)}
                data-testid={`report-item-${r.report_id}`}
                className={`min-w-[200px] lg:min-w-0 w-full text-left p-3 border transition-colors duration-75 shrink-0 ${
                  activeReport?.report_id === r.report_id
                    ? "border-[#00FF41] bg-[#0A0A0A]"
                    : "border-[#222] bg-transparent hover:border-[#444]"
                }`}
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
                  </p>
                )}
              </button>
            ))}
            </div>
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3 bg-[#0A0A0A] border border-[#333] p-4 md:p-8 min-h-[300px] md:min-h-[400px] relative order-1 lg:order-2" data-testid="report-content">
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
                    // Inline markdown bold rendering helper
                    const renderInline = (text) => {
                      const parts = text.split(/(\*\*[^*]+\*\*)/g);
                      return parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={j} className="text-[#00FF41] font-bold">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={j}>{part}</span>;
                      });
                    };

                    if (line.startsWith('# ')) {
                      return <h2 key={i} className="font-heading text-xl font-bold text-[#00FF41] mt-6 mb-3 uppercase">{renderInline(line.replace('# ', ''))}</h2>;
                    }
                    if (line.startsWith('## ')) {
                      return <h3 key={i} className="font-heading text-lg font-semibold text-[#EDEDED] mt-4 mb-2">{renderInline(line.replace('## ', ''))}</h3>;
                    }
                    if (line.startsWith('### ')) {
                      return <h4 key={i} className="font-heading text-base font-semibold text-[#A1A1AA] mt-3 mb-1">{renderInline(line.replace('### ', ''))}</h4>;
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="flex gap-2 ml-2 my-1.5">
                          <span className="text-[#00FF41] shrink-0">&gt;</span>
                          <span>{renderInline(line.replace('- ', ''))}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="my-1">{renderInline(line)}</p>;
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
