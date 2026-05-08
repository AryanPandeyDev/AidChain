import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./components/Toast";
import AdminPasswordGuard from "./components/AdminPasswordGuard";
import RouteGuard, { RedirectIfSignedIn } from "./components/RouteGuard";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import WhySection from "./components/WhySection";
import HowItWorks from "./components/HowItWorks";
import FeaturedPools from "./components/FeaturedPools";
import TrustScoring from "./components/TrustScoring";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";
import SignIn from "./pages/SignIn";
import Register from "./pages/Register";
import WalletProvider from "./wallet/WalletProvider";
import DonorDashboard from "./pages/DonorDashboard";
import NgoApplication from "./pages/NgoApplication";
import NgoApplicationStatus from "./pages/NgoApplicationStatus";
import BrowsePools from "./pages/BrowsePools";
import AdminDashboard from "./pages/AdminDashboard";
import AdminNgoReview from "./pages/AdminNgoReview";
import NgoDashboard from "./pages/NgoDashboard";
import ProofSubmission from "./pages/ProofSubmission";
import CreatePool from "./pages/CreatePool";
import PoolDetail from "./pages/PoolDetail";
import PoolDetailPublic from "./pages/PoolDetailPublic";
import SSOCallback from "./pages/SSOCallback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000 },
  },
});

export default function App() {
  const [page, setPage] = useState(window.location.hash);

  useEffect(() => {
    const handler = () => setPage(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const renderPage = () => {
    // ── Parameterized routes ──────────────────────────────────
    if (page.startsWith("#/admin/pool-detail"))
      return <AdminPasswordGuard><PoolDetail /></AdminPasswordGuard>;
    if (page.startsWith("#/pool/"))
      return <PoolDetailPublic />;

    switch (page) {
      // ── Auth routes — redirect to dashboard if already signed in ──
      case "#/signin":
        return <RedirectIfSignedIn><SignIn /></RedirectIfSignedIn>;
      case "#/register":
        return <RedirectIfSignedIn><Register /></RedirectIfSignedIn>;
      case "#/sso-callback":
        return <SSOCallback />;

      // ── Public routes ──────────────────────────────────────
      case "#/pools":
        return <BrowsePools />;

      // ── Donor routes (signed-in, any role) ─────────────────
      case "#/dashboard":
        return <RouteGuard><DonorDashboard /></RouteGuard>;

      // ── NGO routes (signed-in + NGO role) ──────────────────
      case "#/ngo/apply":
        return <RouteGuard role="NGO"><NgoApplication /></RouteGuard>;
      case "#/ngo/status":
        return <RouteGuard role="NGO"><NgoApplicationStatus /></RouteGuard>;
      case "#/ngo/dashboard":
        return <RouteGuard role="NGO"><NgoDashboard /></RouteGuard>;
      case "#/ngo/submit-proof":
        return <RouteGuard role="NGO"><ProofSubmission /></RouteGuard>;

      // ── Admin routes (signed-in + ADMIN role) ──────────────
      case "#/admin":
      case "#/admin/admin-dash":
        return <AdminPasswordGuard><AdminDashboard /></AdminPasswordGuard>;
      case "#/admin/ngo-apps":
        return <AdminPasswordGuard><AdminNgoReview /></AdminPasswordGuard>;
      case "#/admin/create-pool":
        return <AdminPasswordGuard><CreatePool /></AdminPasswordGuard>;

      // ── Landing page (public) ──────────────────────────────
      default:
        return (
          <div className="bg-background text-on-background min-h-screen">
            <Navbar />
            <main className="pt-xl">
              <Hero />
              <WhySection />
              <HowItWorks />
              <FeaturedPools />
              <TrustScoring />
              <CTASection />
            </main>
            <Footer />
          </div>
        );
    }
  };

  return (
    <AuthProvider>
      <WalletProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            {renderPage()}
          </ToastProvider>
        </QueryClientProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
