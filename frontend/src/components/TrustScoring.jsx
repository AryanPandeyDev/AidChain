export default function TrustScoring() {
  return (
    <section id="impact" className="py-xl">
      <div className="max-w-container-max mx-auto px-gutter text-center mb-xl">
        <h2 className="text-4xl font-bold text-primary leading-snug">
          Decentralized Trust Scoring
        </h2>
        <p className="text-on-surface-variant max-w-2xl mx-auto mt-sm leading-relaxed">
          We rank NGOs based on historical on-chain performance, data accuracy,
          and verified impact. Total accountability, zero bias.
        </p>
      </div>
      <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 md:grid-cols-2 gap-lg items-center">
        {/* NGO Score Card */}
        <div className="bg-white p-lg rounded-3xl shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between mb-lg">
            <div className="flex items-center gap-md">
              <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl">
                  corporate_fare
                </span>
              </div>
              <div>
                <h4 className="text-xl font-bold text-primary">
                  Global Relief Corp
                </h4>
                <span className="text-sm text-on-surface-variant">
                  Verified Partner since 2022
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-secondary">9.8</div>
              <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                Impact Score
              </div>
            </div>
          </div>
          <div className="space-y-md">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Verification Accuracy</span>
                <span className="font-bold">99.2%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-low rounded-full">
                <div className="bg-primary h-full rounded-full w-[99%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Fund Utilization Speed</span>
                <span className="font-bold">Fast</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-low rounded-full">
                <div className="bg-primary h-full rounded-full w-[85%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Badge */}
        <div className="bg-secondary-fixed p-lg rounded-3xl border-2 border-dashed border-secondary/30">
          <h3 className="text-xl font-bold text-primary mb-md">
            Our Verification Badge
          </h3>
          <p className="text-on-secondary-fixed-variant leading-relaxed mb-lg">
            NGOs that maintain a score above 9.0 are awarded the &quot;AidChain Gold
            Seal,&quot; signifying the highest level of operational transparency in
            the sector.
          </p>
          <div className="flex justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-primary border-dashed rounded-full animate-spin-slow"></div>
              <div className="w-32 h-32 bg-primary rounded-full flex flex-col items-center justify-center text-on-primary text-center p-sm">
                <span
                  className="material-symbols-outlined text-5xl"
                  style={{
                    fontVariationSettings: "'FILL' 1, 'wght' 200",
                  }}
                >
                  workspace_premium
                </span>
                <span className="text-[10px] font-bold uppercase tracking-tight mt-1">
                  GOLD SEAL VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
