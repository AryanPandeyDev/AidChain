import { useState } from "react";

export default function CTASection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail("");
    }
  };

  return (
    <section id="donate" className="py-xl">
      <div className="max-w-container-max mx-auto px-gutter">
        <div className="bg-primary-container rounded-[40px] p-lg md:p-xl text-center relative overflow-hidden">
          {/* Background pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.4)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.3)_0%,transparent_40%)]"></div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-on-primary mb-md relative z-10 leading-tight">
            Ready to Join the Mission?
          </h2>
          <p className="text-lg text-primary-fixed-dim mb-lg max-w-2xl mx-auto relative z-10 leading-relaxed">
            Whether you&apos;re a donor looking for certainty or an NGO seeking
            radical accountability, AidChain is your platform for the future of
            aid.
          </p>
          <div className="max-w-md mx-auto">
            <form
              className="flex flex-col md:flex-row gap-sm relative z-10"
              onSubmit={handleSubmit}
            >
              <input
                className="flex-grow px-6 py-3 rounded-full bg-white/10 border border-primary-fixed-dim text-on-primary placeholder:text-primary-fixed-dim focus:ring-2 focus:ring-secondary focus:border-secondary"
                placeholder="Your email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="px-8 py-3 bg-secondary text-on-secondary rounded-full font-bold hover:bg-secondary-container hover:text-on-secondary-container transition-colors"
              >
                {submitted ? "Joined! ✓" : "Join Us"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
