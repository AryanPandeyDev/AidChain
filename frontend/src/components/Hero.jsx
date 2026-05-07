export default function Hero() {
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
              href="#projects"
              className="px-8 py-4 bg-primary text-on-primary rounded-full text-base font-bold active:scale-95 transition-transform hover:bg-primary-container"
            >
              Start Donating
            </a>
            <a
              href="#methodology"
              className="px-8 py-4 border-2 border-primary text-primary rounded-full text-base font-bold active:scale-95 transition-transform hover:bg-primary hover:text-on-primary"
            >
              Become a Partner
            </a>
          </div>
        </div>

        {/* Right - Hero image */}
        <div className="relative mt-8 lg:mt-0">
          {/* Organic Background Shape */}
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-secondary-container opacity-20 rounded-full blur-3xl"></div>
          <div className="organic-mask overflow-hidden border-4 border-surface-container-high">
            <img
              className="w-full h-[480px] object-cover"
              alt="Humanitarian workers engaging with local communities"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAM20L69Ul128x7icOKFVHlVcLOMVbzUOHh_GBoeiGKM-hbyOPboDnJPeLIJs3NP9GVuTyCfMyLIFLsj4tJ2fhzRYUDpb1zTx5-zWbLujXWP-C1zXtsnh5hBg4HfKtWkAlR2TuenwqwGxY-6KEaF8FqClfAxT6u6Z-e4eYUh9HSSPcmtR7YO_uShEhqI_-7SpTvF4aS_YoiX97TShRLAvCUQ6zC8kYW40PghtOCp6xplTbpnRf1p-sgi34f8eFWTuL4qsmsWjbgeFk"
            />
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
