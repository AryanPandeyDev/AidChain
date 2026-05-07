import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createPool } from "../api/admin";

const ADMIN_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "admin-dash" },
  { icon: "verified_user", label: "NGO Applications", id: "ngo-apps" },
  { icon: "diversity_3", label: "Crisis Pools", id: "pools" },
  { icon: "menu_book", label: "Impact Ledger", id: "ledger" },
  { icon: "settings", label: "Settings", id: "settings" },
];

export default function CreatePool() {
  const [form, setForm] = useState({
    name: "", description: "", region: "",
    region_lat: "", region_lng: "", region_radius_km: "",
    target_amount: "1000000",
    max_per_claim: "5000", max_per_ngo_per_day: "25000",
    max_per_ngo_pool: "100000",
  });

  const u = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const valid =
    Number(form.max_per_claim) <= Number(form.max_per_ngo_per_day) &&
    Number(form.max_per_ngo_per_day) <= Number(form.max_per_ngo_pool);

  const mutation = useMutation({
    mutationFn: () => createPool({
      name: form.name,
      description: form.description,
      region: form.region,
      region_lat: parseFloat(form.region_lat) || 0,
      region_lng: parseFloat(form.region_lng) || 0,
      region_radius_km: parseFloat(form.region_radius_km) || 50,
      target_amount: parseFloat(form.target_amount) || 0,
      max_per_claim: parseFloat(form.max_per_claim) || 0,
      max_per_ngo_per_day: parseFloat(form.max_per_ngo_per_day) || 0,
      max_per_ngo_pool: parseFloat(form.max_per_ngo_pool) || 0,
    }),
    onSuccess: (data) => {
      alert(`Pool created! ID: ${data.pool_id}\nContract: ${data.contract_address}`);
      window.location.hash = "#/admin";
    },
    onError: (err) => alert("Deploy failed: " + err.message),
  });

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 top-0 h-screen w-[200px] bg-surface-container-low flex flex-col z-50 border-r border-outline-variant">
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-xl">account_balance</span>
          </div>
          <div>
            <div className="text-lg font-extrabold text-primary leading-tight">AidChain</div>
            <div className="text-lg font-extrabold text-primary leading-tight">Admin</div>
            <div className="text-[10px] text-on-surface-variant">Verified Ledger</div>
          </div>
        </div>
        <div className="px-3 mb-4">
          <a href="#/admin/create-pool" className="flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm">
            <span className="material-symbols-outlined text-lg">add</span> New Crisis Pool
          </a>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {ADMIN_NAV.map((item) => (
            <a key={item.id} href={`#/admin/${item.id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.id === "pools" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"
              }`}>
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="px-3 pb-4 space-y-1 border-t border-outline-variant pt-3">
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-xl">support_agent</span> Support</a>
          <a href="#/" className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-xl">logout</span> Sign Out</a>
        </div>
      </aside>

      <main className="ml-[200px] flex-1 p-8 pb-16">
        <div className="max-w-[700px] mx-auto">
          <a href="#/admin" className="flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary mb-3">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Pools
          </a>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-1">Create Crisis Pool</h1>
          <p className="text-sm text-on-surface-variant mb-8">Deploy a new crisis pool smart contract with immutable fund protection caps.</p>

          {mutation.error && (
            <div className="bg-error-container border border-error rounded-xl p-4 mb-6">
              <p className="text-sm text-on-error-container">{mutation.error.message}</p>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-primary mb-5">Pool Information</h2>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Pool Name</label>
              <input type="text" placeholder="Turkey Earthquake Relief" value={form.name} onChange={u("name")}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Description</label>
              <textarea placeholder="Provide details about the crisis..." value={form.description} onChange={u("description")} rows={4}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary resize-none"></textarea>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Region</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">location_on</span>
                <input type="text" placeholder="Hatay, Turkey" value={form.region} onChange={u("region")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-1.5">Region Coordinates</label>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Latitude" value={form.region_lat} onChange={u("region_lat")}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Longitude" value={form.region_lng} onChange={u("region_lng")}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
                <div className="relative">
                  <input type="text" placeholder="Radius" value={form.region_radius_km} onChange={u("region_radius_km")}
                    className="w-full px-4 py-2.5 pr-12 rounded-xl bg-surface-container-low border border-outline-variant text-sm focus:outline-none focus:border-primary" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">km</span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-on-surface">Target Amount (USDC)</label>
                <span className="text-[11px] text-on-surface-variant italic">Display only, not enforced on-chain</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">$</span>
                <input type="text" value={form.target_amount} onChange={u("target_amount")}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          {/* On-Chain Protection Caps */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">lock</span>
              </div>
              <h2 className="text-xl font-bold text-primary">On-Chain Protection Caps</h2>
            </div>
            <div className="bg-secondary-fixed border border-secondary-fixed-dim rounded-xl px-4 py-3 flex items-start gap-2 mb-5">
              <span className="material-symbols-outlined text-on-secondary-fixed-variant text-xl mt-0.5">warning</span>
              <p className="text-sm text-on-secondary-fixed">These caps are immutable once deployed.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              {[
                ["max_per_claim", "Max Per Claim (USDC)"],
                ["max_per_ngo_per_day", "Max Per NGO Per Day (USDC)"],
                ["max_per_ngo_pool", "Max Per NGO Total (USDC)"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="flex items-center gap-1 text-sm font-bold text-on-surface mb-1.5">
                    {label} <span className="material-symbols-outlined text-on-surface-variant text-sm cursor-help">info</span>
                  </label>
                  <input type="text" value={form[key]} onChange={u(key)}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-sm font-mono focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>
            <div className={`flex items-center gap-1 text-xs font-mono ${valid ? "text-green-600" : "text-error"}`}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{valid ? "check_circle" : "error"}</span>
              Protocol rule: <code className="bg-surface-container-high px-1 py-0.5 rounded text-[11px]">maxPerClaim ≤ maxPerNGOPerDay ≤ maxPerNGOPool</code>
            </div>
          </div>

          {/* Deploy */}
          <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-lg">settings_ethernet</span>
              Deploy CrisisPool smart contract on Polygon. Gas fees apply.
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a href="#/admin" className="px-5 py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-surface-container-low">Cancel</a>
              <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid || !form.name}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60">
                {mutation.isPending ? "Deploying..." : <>Deploy Pool <span className="material-symbols-outlined text-lg">rocket_launch</span></>}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
