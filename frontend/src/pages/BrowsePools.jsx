import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "../api/pools";

const CATEGORIES = ["All", "Emergency", "Sustainability", "Education", "Health", "Infrastructure"];

export default function BrowsePools() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data: pools = [], isLoading, error } = useQuery({ queryKey: ["pools"], queryFn: fetchPools });

  const filtered = useMemo(() => {
    return pools.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q);
      const matchCat = category === "All" || (p.tag || "").toLowerCase() === category.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [pools, search, category]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="bg-primary-container px-8 py-6">
        <div className="max-w-[1200px] mx-auto">
          <h1 className="text-3xl font-extrabold text-on-primary mb-1">Browse Crisis Pools</h1>
          <p className="text-sm text-on-primary-container mb-4">Support verified humanitarian operations with transparent, on-chain donations.</p>
          <div className="relative max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input type="text" placeholder="Search by name or region..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-lowest text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary" />
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-6">
        {/* Category Chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                category === c ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}>{c}</button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-on-surface-variant">Loading pools...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-16">
            <p className="text-sm text-error mb-2">Failed to load pools</p>
            <p className="text-xs text-on-surface-variant">{error.message}</p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((pool) => (
              <div key={pool.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-40 bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/30">water_drop</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-primary">{pool.name}</h3>
                    {pool.tag && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">{pool.tag}</span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">{pool.description}</p>
                  <div className="flex items-center gap-1 text-xs text-on-surface-variant mb-3">
                    <span className="material-symbols-outlined text-sm">location_on</span>{pool.region}
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-on-surface-variant">Funded</span>
                      <span className="font-bold text-primary">{pool.percentFunded}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${pool.percentFunded}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                      <span>${pool.fundedAmount?.toLocaleString()} raised</span>
                      <span>${pool.targetAmount?.toLocaleString()} target</span>
                    </div>
                  </div>
                  <a href={`#/pool/${pool.id}`}
                    className="block text-center py-2.5 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform w-full">
                    {pool.donationsPaused ? "Paused" : "Donate Now"}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-3 block">search_off</span>
            <p className="text-on-surface-variant">No pools found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
