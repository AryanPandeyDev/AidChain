const CARDS = [
  {
    icon: "visibility",
    title: "Transparency Gap",
    description:
      'Traditional aid suffers from "black hole" funding. We provide real-time ledger tracking for every cent donated.',
    bgClass: "bg-primary-fixed",
    iconClass: "text-primary",
  },
  {
    icon: "bolt",
    title: "Slow Fund Movement",
    description:
      "Banking delays can cost lives. Using stablecoins on Polygon, funds move globally in seconds, not weeks.",
    bgClass: "bg-secondary-fixed",
    iconClass: "text-secondary",
  },
  {
    icon: "fact_check",
    title: "Weak Verification",
    description:
      "We use OCR and GPS-tagged proof-of-work to verify that services were actually delivered before release.",
    bgClass: "bg-primary-fixed",
    iconClass: "text-primary",
  },
];

export default function WhySection() {
  return (
    <section id="transparency" className="py-xl bg-surface-container-low">
      <div className="max-w-container-max mx-auto px-gutter text-center mb-xl">
        <span className="text-sm font-bold text-secondary uppercase tracking-widest">
          Why AidChain
        </span>
        <h2 className="text-4xl font-bold text-primary mt-sm brush-stroke inline-block px-md leading-snug">
          Radical Transparency by Design
        </h2>
      </div>
      <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 md:grid-cols-3 gap-lg">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="bg-surface p-lg rounded-xl border border-outline-variant hover:shadow-md transition-shadow"
          >
            <div
              className={`w-12 h-12 ${card.bgClass} rounded-lg flex items-center justify-center mb-md`}
            >
              <span className={`material-symbols-outlined ${card.iconClass}`}>
                {card.icon}
              </span>
            </div>
            <h3 className="text-xl font-bold text-primary mb-sm">{card.title}</h3>
            <p className="text-on-surface-variant leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
