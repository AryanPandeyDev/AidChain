import { useAuth } from "../auth/AuthProvider";
import { getDashboardHref } from "./RouteGuard";

export default function Hero() {
  const { isSignedIn, role } = useAuth();

  return (
    <section className="relative py-xl overflow-hidden">
      <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 lg:grid-cols-2 gap-lg items-center">
        {/* Left - Copy */}
        <div className="z-10">
          <h1 className="text-5xl font-extrabold text-primary mb-md leading-tight tracking-tight">
            Change Lives with{" "}
            <span className="relative">
              Transparent Giving
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 8 C50 2, 100 2, 150 6 S250 10, 298 4" stroke="#7c5800" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>.
          </h1>
          <p className="text-lg text-on-surface-variant mb-lg max-w-lg leading-relaxed">
            AidChain uses blockchain to ensure your donations reach those in
            need with 100% transparency and proof of impact. No more guessing
            where your money goes.
          </p>
          <div className="flex flex-wrap gap-sm">
            <a
              href="#/pools"
              className="px-8 py-4 bg-primary text-on-primary rounded-full text-base font-bold active:scale-95 transition-transform hover:bg-primary-container"
            >
              Start Donating
            </a>
            {isSignedIn ? (
              <a
                href={getDashboardHref(role)}
                className="px-8 py-4 border-2 border-primary text-primary rounded-full text-base font-bold active:scale-95 transition-transform hover:bg-primary hover:text-on-primary"
              >
                Go to Dashboard
              </a>
            ) : (
              <a
                href="#/register"
                className="px-8 py-4 border-2 border-primary text-primary rounded-full text-base font-bold active:scale-95 transition-transform hover:bg-primary hover:text-on-primary"
              >
                Create Account
              </a>
            )}
          </div>
        </div>

        {/* Right - Abstract visual */}
        <div className="relative mt-8 lg:mt-0">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-secondary-container opacity-20 rounded-full blur-3xl"></div>
          <div className="rounded-3xl overflow-hidden border-4 border-surface-container-high bg-gradient-to-br from-primary-container via-primary-fixed/30 to-secondary-container p-12 flex flex-col items-center justify-center h-[420px]">
            {/* Abstract blockchain visualization */}
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    volunteer_activism
                  </span>
                </div>
              </div>
              {/* Floating nodes */}
              <div className="absolute -top-2 -right-8 w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-lg">verified</span>
              </div>
              <div className="absolute -bottom-2 -left-10 w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">shield</span>
              </div>
            </div>
            <div className="text-center mt-2">
              <div className="text-2xl font-extrabold text-primary mb-1">Blockchain-Verified</div>
              <div className="text-sm text-on-surface-variant">Every donation tracked on-chain</div>
            </div>
            {/* Stats row */}
            <div className="flex gap-8 mt-6">
              <div className="text-center">
                <div className="text-xl font-extrabold text-secondary">100%</div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Transparent</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-extrabold text-secondary">0%</div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Hidden Fees</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-extrabold text-secondary">24/7</div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Auditable</div>
              </div>
            </div>
          </div>
          {/* Verified badge overlay */}
          <div className="absolute -bottom-4 -left-4 bg-secondary-fixed p-md rounded-xl shadow-lg border-2 border-secondary transform -rotate-2">
            <div className="flex items-center gap-sm">
              <span
                className="material-symbols-outlined text-secondary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <span className="text-sm font-bold uppercase tracking-widest text-on-secondary-fixed">
                100% On-Chain Verified
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
