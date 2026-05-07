import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "../api/pools";

function formatAmount(amount) {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

const TAG_STYLES = {
  EMERGENCY: "bg-primary text-on-primary",
  SUSTAINABILITY: "bg-secondary text-on-secondary",
  EDUCATION: "bg-primary text-on-primary",
  DEFAULT: "bg-primary text-on-primary",
};

const DEFAULT_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBH7s5AcmQAjNaW9Y_2-mzywLTt5MRTXxFBPEGCKe4ZCjYxEwfxfijkkP1p7IKZTf9-91U1y6aq9JoSvD-pXAPUlRBZ2uZf7dddsyVhesnNfqUVZzNb656tyOJfd_c45CTQyH3wUGjw3Hzqc-mmnwlWoPUAM9FjyhPCD6W1LWuq6JnT6kRyu-ms4hu9wc7mTPU2InNYtA3r0rKBnrlwyA-3bybuHFpIr3LQEnlRocW2oQk1rHPLt2YdXIzuG4QF_USJyQuaaHy4bok",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC_zd4ZI_zZNkCsV4ky_7I-lVjPP2Eksm2hPyS5qUM-BfOnUvz-hNrPv06YNA89CxWYVz8W7KpkOd3MrJqxJsmBa1YT6aYugDrff-Xi7tejnH4zCCsECgEpeoWPOLCz0VpZtNJUxjCiWUBhsGTo7A4QQr5bw9eUeiB3_V7ie67QMzDu5tAz0Ks04iJzNsrPF1lktZroYSSNgkHJYiuIOtzLtQ5bMPMWVBdnJHiBXBmRrqHt-u0X1VkfybrIYidYSJUFPqmZxp8aNDo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAJ6HmIBBWtZjdq90VFAJqBmeNVuaw52RbrcX5ojFQdYgNQoIhW-SawFESSshBdkj0SkSEvkFjIhHHBNiEWvWvKyFUJwB3pLAaP40A5hJPY_6KvRLeQgX-01T2hjhdTwT84GQ34CrAiXmcYGc0Mkkgy-vGUL1wP-OrzPhWigMpsv8kaQK9MU7hs-9QwpT4MCMuuuMziQdXIlEY_QMdSlJzcrf2vofjZhr5xLRi8F1paw-1ZjRVxNczpBQYti8mlJy9oVGy_iWM-pTw",
];

function PoolCard({ pool, index }) {
  const image = pool.image || DEFAULT_IMAGES[index % DEFAULT_IMAGES.length];
  const tag = pool.tag || (pool.region?.toLowerCase().includes("sudan") ? "EMERGENCY" : "ACTIVE");
  const tagStyle = TAG_STYLES[tag] || TAG_STYLES.DEFAULT;

  return (
    <div className="bg-surface rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group">
      <div className="relative overflow-hidden h-48">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          alt={pool.name}
          src={image}
        />
        <div
          className={`absolute top-4 left-4 ${tagStyle} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}
        >
          {tag}
        </div>
      </div>
      <div className="p-lg">
        <h3 className="text-xl font-bold text-primary mb-1">{pool.name}</h3>
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
        <button
          className="w-full mt-lg py-3 border-2 border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-on-primary transition-colors"
          disabled={pool.donationsPaused}
        >
          {pool.donationsPaused ? "Paused" : "Donate Now"}
        </button>
      </div>
    </div>
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
          href="#projects"
        >
          View All Projects{" "}
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
          : displayPools.map((pool, i) => (
              <PoolCard key={pool.id} pool={pool} index={i} />
            ))}
      </div>
      {isError && (
        <p className="text-center text-on-surface-variant mt-md text-sm">
          Showing cached data — backend is currently unreachable.
        </p>
      )}
    </section>
  );
}
