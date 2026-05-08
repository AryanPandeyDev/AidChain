import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchNgoDashboard, submitProof } from "../api/ngo";

const STEPS = ["Select Pool", "Upload Receipt", "Verify Data", "Submit"];

export default function ProofSubmission() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    pool_id: "", receipt_image_url: "", claimed_amount: "",
    ocr_amount: "", ocr_vendor: "", ocr_date: "",
    latitude: "", longitude: "",
  });
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | loading | success | error

  // Fetch assigned pools from backend
  const { data: dashboard } = useQuery({ queryKey: ["ngoDashboard"], queryFn: fetchNgoDashboard, retry: 1 });
  const pools = dashboard?.assigned_pools || [];

  const u = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // GPS auto-fetch on step 2
  useEffect(() => {
    if (step === 2 && !form.latitude) {
      setGpsStatus("loading");
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
          setGpsStatus("success");
        },
        () => setGpsStatus("error"),
        { timeout: 10000 },
      );
    }
  }, [step]);

  const mutation = useMutation({
    mutationFn: () => submitProof({
      pool_id: form.pool_id,
      receipt_image_url: form.receipt_image_url,
      claimed_amount: parseFloat(form.claimed_amount) || 0,
      ocr_amount: parseFloat(form.ocr_amount) || 0,
      ocr_vendor: form.ocr_vendor,
      ocr_date: form.ocr_date,
      latitude: parseFloat(form.latitude) || 0,
      longitude: parseFloat(form.longitude) || 0,
    }),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const selectedPool = pools.find((p) => p.id === form.pool_id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary-container px-8 py-6">
        <div className="max-w-[700px] mx-auto flex items-center justify-between">
          <div>
            <a href="#/ngo/dashboard" className="flex items-center gap-1 text-sm text-on-primary-container mb-1 hover:underline">
              <span className="material-symbols-outlined text-lg">arrow_back</span> Dashboard
            </a>
            <h1 className="text-3xl font-extrabold text-on-primary">Submit Proof</h1>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                  i <= step ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
                }`}>{i + 1}</div>
                <span className={`text-xs font-medium hidden md:inline ${i <= step ? "text-on-primary" : "text-on-surface-variant"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`w-5 h-0.5 ${i < step ? "bg-primary" : "bg-outline-variant"}`}></div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-8 py-8">
        {/* Success state */}
        {submitted ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h2 className="text-2xl font-extrabold text-primary mb-2">Proof Submitted!</h2>
            <p className="text-on-surface-variant text-sm mb-6 max-w-md mx-auto">
              Your proof is now undergoing three-signal verification (OCR match, GPS proximity, historical performance). Funds will be released automatically upon passing.
            </p>
            <a href="#/ngo/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back to Dashboard
            </a>
          </div>
        ) : (
        <>
        {mutation.error && (
          <div className="bg-error-container border border-error rounded-xl p-4 mb-6">
            <p className="text-sm text-on-error-container">{mutation.error.message}</p>
          </div>
        )}

        {/* Step 0: Select Pool */}
        {step === 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
            <h2 className="text-xl font-bold text-primary mb-4">Select Assigned Pool</h2>
            {pools.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No assigned pools. Request assignment first.</p>
            ) : (
              <div className="space-y-3">
                {pools.map((p) => (
                  <button key={p.id} onClick={() => setForm((f) => ({ ...f, pool_id: p.id }))}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      form.pool_id === p.id ? "border-primary bg-primary-fixed/20" : "border-outline-variant hover:border-primary/50"
                    }`}>
                    <div className="font-bold text-primary">{p.name}</div>
                    <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-sm">location_on</span>{p.region}
                      <span className="mx-1">·</span>
                      Max: ${(p.max_per_claim || 0).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Upload Receipt */}
        {step === 1 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
            <h2 className="text-xl font-bold text-primary mb-4">Upload Receipt</h2>
            <p className="text-sm text-on-surface-variant mb-4">Enter the URL of your uploaded receipt image and the amount you're claiming.</p>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Receipt Image URL</label>
              <input type="url" placeholder="https://storage.example.com/receipts/receipt-001.jpg" value={form.receipt_image_url} onChange={u("receipt_image_url")}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Claimed Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">$</span>
                <input type="number" value={form.claimed_amount} onChange={u("claimed_amount")} placeholder="2500"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
              </div>
              {selectedPool && (
                <p className="text-xs text-on-surface-variant mt-1">Max per claim: ${(selectedPool.max_per_claim || 0).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Verify Data */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
              <h2 className="text-xl font-bold text-primary mb-4">OCR Extracted Data</h2>
              <p className="text-sm text-on-surface-variant mb-4">Review and correct the AI-extracted data from your receipt.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">OCR Amount</label>
                  <input type="number" value={form.ocr_amount} onChange={u("ocr_amount")} placeholder="2500"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">OCR Vendor</label>
                  <input type="text" value={form.ocr_vendor} onChange={u("ocr_vendor")} placeholder="Medical Supplies Inc."
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-on-surface mb-1.5">OCR Date</label>
                  <input type="text" value={form.ocr_date} onChange={u("ocr_date")} placeholder="2024-01-15"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
              <h2 className="text-xl font-bold text-primary mb-4">Location Verification</h2>
              <div className="flex items-center gap-3 mb-4">
                <span className={`material-symbols-outlined text-2xl ${gpsStatus === "success" ? "text-green-600" : gpsStatus === "error" ? "text-error" : "text-on-surface-variant"}`}>
                  {gpsStatus === "success" ? "check_circle" : gpsStatus === "error" ? "error" : "my_location"}
                </span>
                <span className="text-sm text-on-surface-variant">
                  {gpsStatus === "loading" ? "Acquiring GPS..." : gpsStatus === "success" ? "GPS location captured" : gpsStatus === "error" ? "GPS failed — enter manually" : "Waiting for GPS..."}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Latitude</label>
                  <input type="text" value={form.latitude} onChange={u("latitude")} placeholder="12.9716"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Longitude</label>
                  <input type="text" value={form.longitude} onChange={u("longitude")} placeholder="77.5946"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
            <h2 className="text-xl font-bold text-primary mb-4">Review & Submit</h2>
            <div className="space-y-3 mb-6">
              {[
                ["Pool", selectedPool?.name || form.pool_id],
                ["Claimed Amount", `$${parseFloat(form.claimed_amount || 0).toLocaleString()}`],
                ["OCR Amount", `$${parseFloat(form.ocr_amount || 0).toLocaleString()}`],
                ["Vendor", form.ocr_vendor || "—"],
                ["Date", form.ocr_date || "—"],
                ["GPS", form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : "Not set"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-outline-variant/50 last:border-0">
                  <span className="text-sm text-on-surface-variant">{k}</span>
                  <span className="text-sm font-bold text-primary">{v}</span>
                </div>
              ))}
            </div>
            <div className="bg-secondary-fixed border border-secondary-fixed-dim rounded-xl p-3 flex items-start gap-2 mb-4">
              <span className="material-symbols-outlined text-on-secondary-fixed-variant text-lg">info</span>
              <p className="text-xs text-on-secondary-fixed">This proof will undergo three-signal verification: OCR match, GPS proximity, and historical performance. Funds are released automatically upon passing.</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="flex items-center gap-1 px-5 py-2.5 text-sm font-bold text-on-surface-variant disabled:opacity-30 hover:text-primary">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)}
              disabled={(step === 0 && !form.pool_id) || (step === 1 && (!form.receipt_image_url || !form.claimed_amount))}
              className="flex items-center gap-1 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
              Next <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          ) : (
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
              {mutation.isPending ? "Submitting..." : <>Submit Proof <span className="material-symbols-outlined text-lg">send</span></>}
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
