import { useState, useMemo } from "react";
import { useSignUp } from "@clerk/clerk-react";

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
  const { signUp, setActive, isLoaded } = useSignUp();
  const [role, setRole] = useState("DONOR");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      const lastName = rest.join(" ") || undefined;

      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
        unsafeMetadata: { role },
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.hash = role === "NGO" ? "#/ngo/apply" : "#/dashboard";
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-lg shadow-primary/5 min-h-[720px]">
        {/* ── Left Panel ── */}
        <div className="relative hidden lg:flex flex-col justify-end p-10">
          <div className="absolute inset-0 bg-primary-container"></div>
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
          <div className="lg:hidden text-2xl font-extrabold text-primary mb-6">
            <a href="#/">AidChain</a>
          </div>

          {!pendingVerification ? (
            <>
              <h1 className="text-3xl font-extrabold text-primary mb-1">
                Join the Mission
              </h1>
              <p className="text-on-surface-variant mb-8">
                Create your account and start making a transparent impact
              </p>

              {error && (
                <div className="bg-error-container border border-error rounded-xl px-4 py-3 mb-6">
                  <p className="text-sm text-on-error-container">{error}</p>
                </div>
              )}

              {/* Role Selector */}
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
                      <div className={`text-sm font-bold mb-1 ${active ? "text-primary" : "text-on-surface"}`}>
                        {r.title}
                      </div>
                      <div className="text-xs text-on-surface-variant leading-snug">{r.desc}</div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
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

              <p className="text-xs text-on-surface-variant text-center mt-6 leading-relaxed">
                By signing up, you agree to our{" "}
                <a href="#" className="font-bold text-on-surface hover:underline">Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="font-bold text-on-surface hover:underline">Privacy Protocol</a>
              </p>

              <p className="text-center text-on-surface-variant mt-4">
                Already have an account?{" "}
                <a href="#/signin" className="font-bold text-secondary hover:underline">
                  Sign in ›
                </a>
              </p>
            </>
          ) : (
            /* ── Email Verification Step ── */
            <>
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-symbols-outlined text-primary text-3xl">mail</span>
                </div>
                <h1 className="text-3xl font-extrabold text-primary mb-2">Verify your email</h1>
                <p className="text-on-surface-variant">
                  We sent a verification code to <strong className="text-primary">{email}</strong>
                </p>
              </div>

              {error && (
                <div className="bg-error-container border border-error rounded-xl px-4 py-3 mb-6">
                  <p className="text-sm text-on-error-container">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-on-surface uppercase tracking-widest mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-center text-2xl font-mono tracking-[0.5em] placeholder:text-outline placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary text-on-primary rounded-full text-base font-bold active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? "Verifying…" : "Verify & Continue"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
