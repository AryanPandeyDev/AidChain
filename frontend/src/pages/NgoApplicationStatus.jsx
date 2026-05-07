import { useQuery } from "@tanstack/react-query";
import { fetchApplicationStatus } from "../api/ngo";

function buildTimeline(status) {
  const steps = [
    { label: "Application Submitted", detail: "Your documents have been received", status: "completed" },
    { label: "AI Pre-Screening", detail: "", status: "upcoming" },
    { label: "Admin Review", detail: "", status: "upcoming" },
    { label: "Verification Complete", detail: "", status: "upcoming" },
  ];

  switch (status) {
    case "AI_SCREENING":
      steps[1].status = "current";
      steps[1].detail = "Automated verification in progress...";
      break;
    case "AI_REJECTED":
      steps[1].status = "completed";
      steps[1].detail = "AI screening flagged issues";
      steps[2].status = "current";
      steps[2].detail = "Escalated for manual review";
      break;
    case "PENDING_REVIEW":
      steps[1].status = "completed";
      steps[1].detail = "Automated verification successful";
      steps[2].status = "current";
      steps[2].detail = "Manual verification in progress";
      break;
    case "VERIFIED":
      steps[1].status = "completed";
      steps[1].detail = "Automated verification successful";
      steps[2].status = "completed";
      steps[2].detail = "Admin approved your application";
      steps[3].status = "completed";
      steps[3].detail = "Trust Score: 50/100";
      break;
    case "REJECTED":
      steps[1].status = "completed";
      steps[1].detail = "Automated verification completed";
      steps[2].status = "completed";
      steps[2].detail = "Application was rejected";
      break;
    default:
      break;
  }
  return steps;
}

export default function NgoApplicationStatus() {
  const { data: app, isLoading, error } = useQuery({
    queryKey: ["appStatus"],
    queryFn: fetchApplicationStatus,
    refetchInterval: 10_000, // poll every 10s for status changes
  });

  const status = app?.status || "PENDING_REVIEW";
  const timeline = buildTimeline(status);

  const headingMap = {
    AI_SCREENING: "AI Screening In Progress",
    AI_REJECTED: "AI Screening Flagged",
    PENDING_REVIEW: "Application Under Review",
    VERIFIED: "Verification Complete! 🎉",
    REJECTED: "Application Rejected",
  };

  const iconMap = {
    AI_SCREENING: "smart_toy",
    AI_REJECTED: "warning",
    PENDING_REVIEW: "hourglass_top",
    VERIFIED: "verified",
    REJECTED: "cancel",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block">error</span>
          <h2 className="text-xl font-bold text-primary mb-2">No Application Found</h2>
          <p className="text-sm text-on-surface-variant mb-6">{error.message}</p>
          <a href="#/ngo/apply" className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform inline-block">
            Apply Now
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative flex flex-col items-center justify-center p-6">
      {/* Faded background */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.05] pointer-events-none">
        <div className="w-full h-full bg-gradient-to-br from-primary-fixed to-secondary-fixed"></div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[640px] bg-surface-container-lowest border border-outline-variant rounded-3xl p-10 shadow-lg shadow-primary/5 text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-primary text-3xl">{iconMap[status] || "info"}</span>
        </div>

        <h1 className="text-3xl font-extrabold text-primary mb-2">{headingMap[status] || "Application Status"}</h1>
        <p className="text-on-surface-variant max-w-sm mx-auto mb-8">
          {status === "VERIFIED" ? "Welcome aboard! You can now browse and claim from crisis pools." :
           status === "REJECTED" ? app?.rejection_reason || "Your application did not meet our requirements." :
           "Our team is reviewing your documents. This usually takes 1–2 business days."}
        </p>

        <div className="flex gap-6 text-left">
          {/* Timeline */}
          <div className="flex-1">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">Status Timeline</h3>
            <div className="space-y-0">
              {timeline.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {step.status === "completed" ? (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-on-primary text-sm" style={{ fontSize: "14px" }}>check</span>
                      </div>
                    ) : step.status === "current" ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-outline-variant flex-shrink-0"></div>
                    )}
                    {i < timeline.length - 1 && (
                      <div className={`w-0.5 h-8 ${step.status === "completed" ? "bg-primary" : "bg-outline-variant"}`}></div>
                    )}
                  </div>
                  <div className="pb-6">
                    <div className={`text-sm font-bold ${step.status === "upcoming" ? "text-on-surface-variant/50" : "text-primary"}`}>{step.label}</div>
                    {step.detail && <div className="text-xs text-on-surface-variant mt-0.5">{step.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="w-[200px] flex-shrink-0 bg-surface-container-low border border-outline-variant rounded-xl p-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-widest mb-3">Summary</h4>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-on-surface-variant">Application ID</div>
                <div className="text-sm font-mono font-bold text-primary">{app?.id?.substring(0, 8)}...</div>
              </div>
              <div>
                <div className="text-[11px] text-on-surface-variant">Status</div>
                <div className="text-sm font-bold text-primary">{status.replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-[11px] text-on-surface-variant">Submitted</div>
                <div className="text-sm text-primary">{app?.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}</div>
              </div>
              {app?.reviewed_at && (
                <div>
                  <div className="text-[11px] text-on-surface-variant">Reviewed</div>
                  <div className="text-sm text-primary">{new Date(app.reviewed_at).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <hr className="border-outline-variant my-6" />

        <div className="flex items-center justify-center gap-4">
          {status === "VERIFIED" && (
            <a href="#/ngo/dashboard" className="inline-flex items-center gap-1 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform">
              Go to Dashboard <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </a>
          )}
          {status === "REJECTED" && (
            <a href="#/ngo/apply" className="inline-flex items-center gap-1 px-6 py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-surface-container-low transition-colors">
              Reapply <span className="material-symbols-outlined text-lg">refresh</span>
            </a>
          )}
          <a href="#" className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
            Need help? Contact support <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </a>
        </div>
      </div>
    </div>
  );
}
