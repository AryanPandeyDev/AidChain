import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "../api/pools";

function formatAmount(amount) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

const TAG_STYLES = {
  EMERGENCY: "bg-error text-on-error",
  SUSTAINABILITY: "bg-secondary text-on-secondary",
  ACTIVE: "bg-secondary text-on-secondary",
  DEFAULT: "bg-primary text-on-primary",
};

function PoolCard({ pool }) {
  const tag = pool.tag || "ACTIVE";
  const tagStyle = TAG_STYLES[tag] || TAG_STYLES.DEFAULT;

  return (
    <a href={`#/pool/${pool.id}`} className="bg-surface rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group block">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-primary-container to-primary-fixed/40 px-lg py-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs text-on-primary-container">
            <span className="material-symbols-outlined text-sm">location_on</span>
            {pool.region || "Global"}
          </div>
          <span className={`${tagStyle} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}>
            {tag}
          </span>
        </div>
        <h3 className="text-xl font-bold text-primary group-hover:text-secondary transition-colors">{pool.name}</h3>
      </div>
      <div className="p-lg">
        <p className="text-on-surface-variant text-sm mb-md line-clamp-2 leading-relaxed">
          {pool.description}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">
              {pool.percentFunded}% funded
            </span>
            <span className="font-bold text-primary">
              {formatAmount(pool.fundedAmount)} / {formatAmount(pool.targetAmount)}
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pool.percentFunded, 100)}%` }}
            ></div>
          </div>
        </div>
        <div
          className="w-full mt-lg py-3 border-2 border-primary text-primary font-bold rounded-full group-hover:bg-primary group-hover:text-on-primary transition-colors text-center"
        >
          {pool.donationsPaused ? "View Details" : "Donate Now"}
        </div>
      </div>
    </a>
  );
}

export default function FeaturedPools() {
  const { data: pools = [], isLoading, isError } = useQuery({
    queryKey: ["pools"],
    queryFn: fetchPools,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const displayPools = pools.slice(0, 3);

  return (
    <section id="projects" className="py-xl bg-surface-container">
      <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row justify-between items-end mb-xl gap-md">
        <div>
          <span className="text-sm font-bold text-secondary uppercase tracking-widest">
            Active Impact
          </span>
          <h2 className="text-4xl font-bold text-primary leading-snug">Featured Crisis Pools</h2>
        </div>
        <a
          className="text-primary font-bold flex items-center gap-1 hover:underline"
          href="#/pools"
        >
          View All Pools{" "}
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </a>
      </div>
      <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 md:grid-cols-3 gap-lg">
        {isLoading
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-surface rounded-2xl overflow-hidden shadow-sm animate-pulse"
              >
                <div className="h-48 bg-surface-container-highest"></div>
                <div className="p-lg space-y-md">
                  <div className="h-6 bg-surface-container-highest rounded w-2/3"></div>
                  <div className="h-4 bg-surface-container-highest rounded w-full"></div>
                  <div className="h-4 bg-surface-container-highest rounded w-1/2"></div>
                  <div className="h-2 bg-surface-container-highest rounded-full"></div>
                  <div className="h-10 bg-surface-container-highest rounded-full mt-lg"></div>
                </div>
              </div>
            ))
          : displayPools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
      </div>
      {isError && (
        <p className="text-center text-on-surface-variant mt-md text-sm">
          Could not load pools — the backend may be starting up.
        </p>
      )}
    </section>
  );
}
