const STEPS = [
  {
    num: 1,
    title: "Direct Funding",
    desc: "Deploy USDC directly to project pools. Your capital remains locked in a smart contract until milestones are met.",
  },
  {
    num: 2,
    title: "Proof-Based Verification",
    desc: "NGOs upload receipts and GPS-located photos. Our AI-driven OCR validates data against the project requirements.",
  },
  {
    num: 3,
    title: "Timelocked Release",
    desc: "Once verified, funds are released in batches, ensuring ongoing accountability throughout the project lifecycle.",
  },
];

export default function HowItWorks() {
  return (
    <section id="methodology" className="py-xl">
      <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 lg:grid-cols-2 gap-xl items-center">
        {/* Steps */}
        <div className="order-2 lg:order-1">
          <div className="space-y-lg">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-md">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xl">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primary">{step.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blockchain Ledger Visual */}
        <div className="order-1 lg:order-2 bg-surface-container-high p-lg rounded-3xl relative">
          <div className="bg-surface rounded-2xl shadow-xl overflow-hidden border border-primary/10">
            {/* Ledger header */}
            <div className="p-md bg-primary text-on-primary flex justify-between items-center">
              <span className="text-sm font-bold uppercase tracking-widest">
                Blockchain Transaction Ledger
              </span>
              <span className="text-xs font-mono opacity-80">0x7a...F92</span>
            </div>

            {/* Ledger rows */}
            <div className="p-md space-y-md font-mono text-sm">
              <div className="flex justify-between items-center border-b border-surface-container-highest pb-sm">
                <span className="text-on-surface-variant">
                  MILESTONE_1_VERIFIED
                </span>
                <span className="text-primary font-bold">+5,000 USDC</span>
              </div>
              <div className="flex justify-between items-center border-b border-surface-container-highest pb-sm">
                <span className="text-on-surface-variant">
                  REMITTANCE_GAS_OPTIMIZED
                </span>
                <span className="text-secondary font-bold">0.002 MATIC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">
                  IMPACT_SCORE_UPDATED
                </span>
                <span className="text-primary font-bold">A+ (9.8/10)</span>
              </div>
            </div>

            {/* Ledger image */}
            <div className="p-md">
              <img
                className="w-full h-48 object-cover rounded-xl"
                alt="Blockchain ledger on tablet in a community clinic"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2m0oCdBCjKRJAW8Xmvla2kQlHeClnK4EUQFZSrS3Q5ZcYNhYLJcICHReO7NdkkcpClREtmD0Mq0JEdrXlvN3ZI0osW7sW-5Ko8CtoUS_hFNPulTYhxfOXZ7rEvQQPMTBnqMsrz3CRTvvrjhZ4W8aqJDbQ5s4xlMuVw1x7MdJiR6M0HrZTXpWp4Cf81P9S3cTSbTKdmCwe7oGLbR27IHafskzhTgpWqlAnbYSjMdBjc4gQUovJ2ST0O19_svmeEWrqbB4SoSZRVkc"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
