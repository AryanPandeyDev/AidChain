import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";

export default function SignIn() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.hash = "#/dashboard";
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: window.location.origin + "/#/sso-callback",
        redirectUrlComplete: window.location.origin + "/#/dashboard",
      });
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || "Google sign in failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-2 rounded-3xl overflow-hidden shadow-lg shadow-primary/5">
        {/* ── Left Panel: Hero ── */}
        <div className="relative hidden lg:flex flex-col justify-end p-10 min-h-[640px]">
          <div className="absolute inset-0 bg-primary-container"></div>

          <div className="absolute top-10 left-10 z-10">
            <a href="#/" className="text-3xl font-extrabold text-on-primary tracking-tight">
              AidChain
            </a>
          </div>

          <div className="relative z-10">
            <div className="w-24 h-1 bg-secondary-container rounded-full mb-4"></div>
            <h2 className="text-3xl font-extrabold text-on-primary leading-tight mb-3">
              Empowerment through
              <br />
              radical transparency.
            </h2>
            <p className="text-primary-fixed-dim text-base leading-relaxed max-w-sm">
              A reliable digital ledger wrapped in a warm,
              <br />
              human-centric narrative.
            </p>
          </div>
        </div>

        {/* ── Right Panel: Sign In Form ── */}
        <div className="bg-surface-container-lowest flex flex-col justify-center px-10 py-14 lg:px-14">
          <div className="lg:hidden text-2xl font-extrabold text-primary mb-8">
            <a href="#/">AidChain</a>
          </div>

          <h1 className="text-3xl font-extrabold text-primary text-center mb-1">
            Welcome back
          </h1>
          <p className="text-on-surface-variant text-center mb-10">
            Sign in to continue your impact journey
          </p>

          {error && (
            <div className="bg-error-container border border-error rounded-xl px-4 py-3 mb-6">
              <p className="text-sm text-on-error-container">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-on-surface uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-on-surface uppercase tracking-widest">
                  Password
                </label>
                <a
                  href="#forgot"
                  className="text-sm font-bold text-secondary hover:text-secondary-container transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors pr-12"
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-on-primary rounded-full text-base font-bold active:scale-[0.98] hover:bg-primary-container transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-outline-variant"></div>
            <span className="text-sm text-on-surface-variant">or continue with</span>
            <div className="flex-1 h-px bg-outline-variant"></div>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogle}
            className="w-full py-3 border border-outline-variant rounded-full flex items-center justify-center gap-3 text-on-surface font-bold hover:bg-surface-container-low transition-colors active:scale-[0.98]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          {/* Sign Up Link */}
          <p className="text-center text-on-surface-variant mt-8">
            New to AidChain?{" "}
            <a
              href="#/register"
              className="font-bold text-secondary hover:underline"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
