import { useState, useMemo } from "react";

const ROLES = [
  {
    id: "DONOR",
    icon: "volunteer_activism",
    title: "I want to donate",
    desc: "Fund crisis pools and track your impact with full transparency.",
  },
  {
    id: "NGO",
    icon: "account_balance",
    title: "I represent an NGO",
    desc: "Register your organization and receive verified funding.",
  },
];

function getPasswordStrength(pw) {
  if (!pw) return { label: "", color: "bg-outline-variant", pct: 0 };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: "Weak", color: "bg-error", pct: 20 };
  if (score <= 2) return { label: "Fair", color: "bg-secondary-container", pct: 40 };
  if (score <= 3) return { label: "Good", color: "bg-secondary", pct: 65 };
  return { label: "Strong", color: "bg-primary", pct: 100 };
}

export default function Register() {
  const [role, setRole] = useState("DONOR");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Clerk auth will replace this
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-lg shadow-primary/5 min-h-[720px]">
        {/* ── Left Panel: Illustration Hero ── */}
        <div className="relative hidden lg:flex flex-col justify-end p-10">
          {/* Illustration background */}
          <div className="absolute inset-0">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkKDvQ2NZUmQsRJBndqSlYY6iKNMeC0-gmxi1trVzokVBi53hOzZkPaUf3zSn5yISqicoobqpVFH_zPetrJywOWGWKNL_EUBVwga_nHcsNiyd87bjeILVxpawfSvv_u1d82JyhPW3yjtrCRbq0kszj1Et-it7FDc-7j8-pPFCPZNZnm1nZgI1oszfLv0OwLMY0WEntz3dGAYZz7ZzPUVX7dZgvgyI7kM9yDgjshda_BI3-uXwf76CjoeL4awVXqNGJOX_xxxBLz3s"
              alt="Humanitarian aid workers in the field"
              className="w-full h-full object-cover"
            />
            {/* Dark gradient overlay at bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary-container/90 via-primary-container/30 to-transparent"></div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold text-on-primary leading-tight mb-2">
              AidChain
            </h2>
            <p className="text-lg text-primary-fixed-dim leading-relaxed">
              Empowerment through radical
              <br />
              transparency.
            </p>
          </div>
        </div>

        {/* ── Right Panel: Registration Form ── */}
        <div className="bg-surface-container-lowest flex flex-col justify-center px-8 py-10 lg:px-12 overflow-y-auto">
          {/* Mobile logo */}
          <div className="lg:hidden text-2xl font-extrabold text-primary mb-6">
            AidChain
          </div>

          <h1 className="text-3xl font-extrabold text-primary mb-1">
            Join the Mission
          </h1>
          <p className="text-on-surface-variant mb-8">
            Create your account and start making a transparent impact
          </p>

          {/* ── Role Selector ── */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    active
                      ? "border-primary bg-primary-fixed/30"
                      : "border-outline-variant bg-surface-container-lowest hover:border-outline"
                  }`}
                >
                  {/* Checkmark badge */}
                  {active && (
                    <span className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-primary text-sm" style={{ fontSize: "14px" }}>
                        check
                      </span>
                    </span>
                  )}
                  <span
                    className={`material-symbols-outlined text-2xl mb-2 block ${
                      active ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {r.icon}
                  </span>
                  <div
                    className={`text-sm font-bold mb-1 ${
                      active ? "text-primary" : "text-on-surface"
                    }`}
                  >
                    {r.title}
                  </div>
                  <div className="text-xs text-on-surface-variant leading-snug">
                    {r.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-on-surface uppercase tracking-widest mb-2">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-on-surface uppercase tracking-widest mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-on-surface uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
              {/* Strength indicator */}
              {password && (
                <div className="mt-2">
                  <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} rounded-full transition-all duration-300`}
                      style={{ width: `${strength.pct}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-on-surface-variant mt-1 inline-block">
                    Password strength: {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-on-primary rounded-full text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] hover:bg-primary-container transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating…
                </span>
              ) : (
                <>
                  Create Account
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Terms */}
          <p className="text-xs text-on-surface-variant text-center mt-6 leading-relaxed">
            By signing up, you agree to our{" "}
            <a href="#" className="font-bold text-on-surface hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="font-bold text-on-surface hover:underline">
              Privacy Protocol
            </a>
          </p>

          {/* Sign in link */}
          <p className="text-center text-on-surface-variant mt-4">
            Already have an account?{" "}
            <a
              href="#/signin"
              className="font-bold text-secondary hover:underline"
            >
              Sign in ›
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
