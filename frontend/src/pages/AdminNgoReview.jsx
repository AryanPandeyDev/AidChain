import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApplications, fetchApplication, approveApplication, rejectApplication } from "../api/admin";
import AdminLayout from "../layouts/AdminLayout";

const STATUS_TABS = ["PENDING_REVIEW", "VERIFIED", "REJECTED"];
const TAB_LABELS = { PENDING_REVIEW: "Pending Review", VERIFIED: "Verified", REJECTED: "Rejected" };

function DetailView({ appId, onBack }) {
  const qc = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const { data: app, isLoading } = useQuery({
    queryKey: ["adminApp", appId],
    queryFn: () => fetchApplication(appId),
  });

  const approveMut = useMutation({
    mutationFn: () => approveApplication(appId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminApps"] }); onBack(); },
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectApplication(appId, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminApps"] }); setShowReject(false); onBack(); },
  });

  if (isLoading || !app) {
    return (
      <AdminLayout activeId="ngo-apps">
        <div className="text-center py-16"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeId="ngo-apps">
      <div className="max-w-[800px] mx-auto">
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary mb-4">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Applications
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-extrabold text-primary tracking-tight">{app.organization_name}</h1>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-on-secondary bg-secondary px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-sm">pending_actions</span>
              {app.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mb-8">Submitted: {new Date(app.created_at).toLocaleDateString()}</p>

          {/* AI Screening */}
          {app.ai_confidence_score != null && (
            <div className="bg-primary-fixed/20 border border-primary-fixed-dim rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                </div>
                <h2 className="text-xl font-bold text-primary">AI Pre-Screening Results</h2>
              </div>
              <div className="bg-primary rounded-xl px-5 py-3 flex items-center justify-between mb-5">
                <span className="text-sm font-bold text-on-primary">Confidence Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-on-primary">{app.ai_confidence_score?.toFixed(2)}</span>
                  <span className="text-sm text-on-primary/70">/ 1.0</span>
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-5">
                <div className={`h-full rounded-full ${app.ai_confidence_score >= 0.7 ? "bg-green-500" : "bg-secondary"}`}
                  style={{ width: `${(app.ai_confidence_score || 0) * 100}%` }}></div>
              </div>
              {app.ai_summary && <p className="text-sm text-on-surface leading-relaxed">{app.ai_summary}</p>}
            </div>
          )}

          {/* Organization Details */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-primary mb-5">Organization Details</h2>
            <hr className="border-outline-variant mb-5" />
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Org Name</div>
                <div className="text-base font-bold text-primary">{app.organization_name}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Country</div>
                <div className="text-base font-bold text-primary">{app.country}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Registration Number</div>
                <div className="text-base font-mono font-bold text-primary">{app.registration_number}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Website</div>
                <a href={app.website} target="_blank" rel="noreferrer" className="text-base font-bold text-primary underline">{app.website || "—"}</a>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-primary mb-4">Uploaded Documents</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Registration Certificate", url: app.registration_doc_url },
                { label: "Tax ID Document", url: app.tax_id_doc_url },
                { label: "Proof of Operation", url: app.proof_of_operation_url },
              ].map((d) => (
                <div key={d.label} className="bg-surface-container-low rounded-xl p-4 text-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">picture_as_pdf</span>
                  <div className="text-xs font-bold text-primary mb-1">{d.label}</div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-secondary hover:underline">View →</a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Actions */}
        {app.status === "PENDING_REVIEW" && (
          <div className="fixed bottom-0 left-[200px] right-0 bg-background border-t border-outline-variant px-8 py-4 z-40">
            <div className="max-w-[800px] mx-auto flex justify-end gap-4">
              <button onClick={() => setShowReject(true)} disabled={rejectMut.isPending}
                className="px-8 py-3 border-2 border-error text-error rounded-full text-sm font-bold hover:bg-error-container">
                Reject
              </button>
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}
                className="px-10 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
                {approveMut.isPending ? "Approving..." : "Approve"}
              </button>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showReject && (
          <div className="fixed inset-0 bg-primary/30 flex items-center justify-center z-[100] p-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-bold text-primary mb-2">Reject Application</h3>
              <p className="text-sm text-on-surface-variant mb-4">Provide a reason for the rejection.</p>
              <textarea placeholder="e.g., Missing financial audit document..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm mb-4 resize-none focus:outline-none focus:border-primary"></textarea>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowReject(false)} className="px-4 py-2 text-sm font-bold text-on-surface-variant">Cancel</button>
                <button onClick={() => rejectMut.mutate()} disabled={!reason || rejectMut.isPending}
                  className="px-6 py-2 bg-error text-on-error rounded-full text-sm font-bold disabled:opacity-60">
                  {rejectMut.isPending ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
    </AdminLayout>
  );
}

export default function AdminNgoReview() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const status = STATUS_TABS[activeTab];

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["adminApps", status],
    queryFn: () => fetchApplications(status),
  });

  if (selectedId) return <DetailView appId={selectedId} onBack={() => setSelectedId(null)} />;

  return (
    <AdminLayout activeId="ngo-apps">
      <div className="max-w-[1000px] mx-auto">
        <h1 className="text-4xl font-extrabold text-primary mb-6">NGO Applications</h1>
          <div className="flex gap-1 border-b border-outline-variant mb-6">
            {STATUS_TABS.map((t, i) => (
              <button key={t} onClick={() => setActiveTab(i)}
                className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px ${activeTab === i ? "text-secondary border-secondary" : "text-on-surface-variant border-transparent hover:text-primary"}`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="text-center py-16"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div></div>
          )}

          {!isLoading && apps.length === 0 && (
            <div className="text-center py-16"><p className="text-on-surface-variant">No {TAB_LABELS[status].toLowerCase()} applications.</p></div>
          )}

          {!isLoading && apps.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead><tr className="border-b border-outline-variant">
                  <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Organization</th>
                  <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Country</th>
                  <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Submitted</th>
                  <th className="px-5 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-widest">Action</th>
                </tr></thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-primary">{a.organization_name}</td>
                      <td className="px-5 py-3.5 text-sm">{a.country}</td>
                      <td className="px-5 py-3.5 text-sm text-on-surface-variant">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5"><button onClick={() => setSelectedId(a.id)} className="text-sm font-bold text-secondary hover:underline">Review →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </AdminLayout>
  );
}
