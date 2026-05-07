import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthProvider";
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
    // Handle parameterized routes first
    if (page.startsWith("#/admin/pool-detail")) return <PoolDetail />;

    switch (page) {
      case "#/signin":
        return <SignIn />;
      case "#/register":
        return <Register />;
      case "#/dashboard":
        return <DonorDashboard />;
      case "#/pools":
        return <BrowsePools />;
      case "#/ngo/apply":
        return <NgoApplication />;
      case "#/ngo/status":
        return <NgoApplicationStatus />;
      case "#/ngo/dashboard":
        return <NgoDashboard />;
      case "#/ngo/submit-proof":
        return <ProofSubmission />;
      case "#/admin":
      case "#/admin/admin-dash":
        return <AdminDashboard />;
      case "#/admin/ngo-apps":
        return <AdminNgoReview />;
      case "#/admin/create-pool":
        return <CreatePool />;
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
      <QueryClientProvider client={queryClient}>{renderPage()}</QueryClientProvider>
    </AuthProvider>
  );
}
