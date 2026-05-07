import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { submitApplication } from "../api/ngo";

const STEPS = [
    { num: 1, label: "Wallet" },
    { num: 2, label: "Organization" },
    { num: 3, label: "Documents" },
    { num: 4, label: "Review" },
];

const COUNTRIES = [
    "India", "Nigeria", "Kenya", "Bangladesh", "Pakistan", "Ethiopia",
    "Tanzania", "Uganda", "Ghana", "South Africa", "Turkey", "Syria",
    "Sudan", "Somalia", "Afghanistan", "Myanmar", "Colombia", "Haiti",
];

const NGO_NAV = [
    { icon: "grid_view", label: "Impact Overview", id: "overview" },
    { icon: "travel_explore", label: "Active Missions", id: "missions" },
    { icon: "menu_book", label: "Aid Ledger", id: "ledger" },
    { icon: "auto_awesome", label: "NGO Dashboard", id: "ngo-dashboard" },
];

export default function NgoApplication() {
    const [step, setStep] = useState(1);
    const [walletAddress, setWalletAddress] = useState(null);
    const [walletError, setWalletError] = useState("");
    const [connecting, setConnecting] = useState(false);
    const [form, setForm] = useState({
        orgName: "",
        country: "",
        regNumber: "",
        website: "",
        description: "",
    });
    const [files, setFiles] = useState({
        regCertificate: null,
        taxId: null,
        proofOfOperation: null,
    });

    const applyMutation = useMutation({
        mutationFn: submitApplication,
        onSuccess: () => { window.location.hash = "#/ngo/status"; },
    });

    const connectWallet = async () => {
        setWalletError("");
        if (!window.ethereum) {
            setWalletError("MetaMask not detected. Please install MetaMask to continue.");
            return;
        }
        setConnecting(true);
        try {
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            if (accounts[0]) {
                setWalletAddress(accounts[0]);
                setStep(2);
            }
        } catch (err) {
            setWalletError(err.code === 4001 ? "Connection rejected. Please approve to continue." : err.message);
        } finally {
            setConnecting(false);
        }
    };

    const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";

    const handleSubmit = () => {
        // For dev: use placeholder URLs since we have no S3 yet.
        // In production these would be pre-signed S3 upload URLs.
        const devUrl = (file) => file
            ? `https://dev-placeholder.aidchain.local/${encodeURIComponent(file.name)}`
            : null;

        applyMutation.mutate({
            organization_name: form.orgName,
            country: form.country,
            registration_number: form.regNumber,
            website: form.website,
            description: form.description,
            wallet_address: walletAddress,
            registration_doc_url: devUrl(files.regCertificate) || "https://dev-placeholder.aidchain.local/reg-cert.pdf",
            tax_id_doc_url: devUrl(files.taxId) || "https://dev-placeholder.aidchain.local/tax-id.pdf",
            proof_of_operation_url: devUrl(files.proofOfOperation) || "https://dev-placeholder.aidchain.local/proof-ops.pdf",
        });
    };

    const update = (field) => (e) =>
        setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleFile = (field) => (e) => {
        if (e.target.files?.[0]) {
            setFiles((f) => ({ ...f, [field]: e.target.files[0] }));
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* ── NGO Sidebar ── */}
            <aside className="fixed left-0 top-0 h-screen w-[200px] bg-primary-container flex flex-col z-50">
                <div className="px-5 pt-6 pb-2">
                    <div className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-primary text-lg">description</span>
                    </div>
                    <div className="text-xl font-extrabold text-on-primary">AidChain</div>
                    <div className="text-xs text-on-primary-container mt-0.5">Verified NGO Partner</div>
                </div>

                <nav className="flex-1 px-3 mt-6 space-y-1">
                    {NGO_NAV.map((item) => {
                        const isActive = item.id === "ngo-dashboard";
                        return (
                            <a
                                key={item.id}
                                href={`#/ngo/${item.id}`}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? "text-secondary font-bold"
                                        : "text-on-primary-container hover:bg-primary/20"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                {item.label}
                                {isActive && (
                                    <span className="ml-auto w-1.5 h-6 bg-secondary rounded-full"></span>
                                )}
                            </a>
                        );
                    })}
                </nav>

                <div className="px-3 mb-6">
                    <a
                        href="#"
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-on-secondary rounded-full font-bold text-sm active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        New Initiative
                    </a>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="ml-[200px] flex-1 p-8 pb-16">
                <div className="max-w-[800px] mx-auto">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h1 className="text-4xl font-extrabold text-primary tracking-tight">
                                Apply for Verification
                            </h1>
                            <p className="text-on-surface-variant mt-1 max-w-lg">
                                Complete your application to become a verified AidChain partner and receive humanitarian funding.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 flex-shrink-0">
                            {walletAddress ? (
                                <>
                                    <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        check_circle
                                    </span>
                                    <div className="text-right">
                                        <div className="text-xs font-mono font-bold text-primary">{shortAddr}</div>
                                        <div className="text-[10px] font-bold text-on-surface-variant">Connected</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-on-surface-variant text-lg">link_off</span>
                                    <div className="text-xs font-bold text-on-surface-variant">Not Connected</div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Progress Stepper ── */}
                    <div className="flex items-center justify-between mb-10 px-4">
                        {STEPS.map((s, i) => {
                            const completed = s.num < step;
                            const active = s.num === step;
                            return (
                                <div key={s.num} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${completed
                                                    ? "bg-primary border-primary text-on-primary"
                                                    : active
                                                        ? "bg-surface-container-lowest border-primary text-primary"
                                                        : "bg-surface-container-highest border-outline-variant text-on-surface-variant"
                                                }`}
                                        >
                                            {completed ? (
                                                <span className="material-symbols-outlined text-lg">check</span>
                                            ) : (
                                                s.num
                                            )}
                                        </div>
                                        <span
                                            className={`mt-2 text-xs font-bold ${active ? "text-primary" : "text-on-surface-variant"
                                                }`}
                                        >
                                            {s.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div
                                            className={`flex-1 h-0.5 mx-3 mt-[-18px] ${completed ? "bg-primary" : "bg-outline-variant"
                                                }`}
                                        ></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Step 1: Wallet Connection ── */}
                    {step === 1 && (
                        <>
                            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 mb-6 text-center">
                                <div className="mx-auto w-16 h-16 bg-primary-fixed/40 rounded-2xl flex items-center justify-center mb-5">
                                    <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
                                </div>
                                <h2 className="text-2xl font-extrabold text-primary mb-2">Connect Your Wallet</h2>
                                <p className="text-on-surface-variant text-sm mb-6 max-w-md mx-auto">
                                    Connect your MetaMask wallet to receive verified humanitarian funding directly on-chain.
                                </p>

                                {walletError && (
                                    <div className="bg-error-container border border-error rounded-xl px-4 py-3 mb-5 max-w-md mx-auto">
                                        <p className="text-sm text-on-error-container">{walletError}</p>
                                    </div>
                                )}

                                <button
                                    onClick={connectWallet}
                                    disabled={connecting}
                                    className="inline-flex items-center gap-3 px-8 py-3.5 bg-primary text-on-primary rounded-full text-base font-bold active:scale-95 transition-transform disabled:opacity-60"
                                >
                                    {connecting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Connecting…
                                        </>
                                    ) : (
                                        <>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21.3 3L12.7 9.5l1.6-3.8L21.3 3z" fill="#E2761B"/><path d="M2.7 3l8.5 6.6-1.5-3.9L2.7 3zm15.8 13.5l-2.3 3.5 4.9 1.3 1.4-4.8h-4zm-17 0l1.4 4.8 4.9-1.3-2.3-3.5H1.5z" fill="#E4761B"/></svg>
                                            Connect MetaMask
                                        </>
                                    )}
                                </button>

                                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
                                    <span className="material-symbols-outlined text-sm">lock</span>
                                    We never access your private keys or funds
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Organization Details ── */}
                    {step === 2 && (
                        <>
                            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 mb-6">
                                <h2 className="text-2xl font-extrabold text-primary mb-1">
                                    Organization Details
                                </h2>
                                <p className="text-on-surface-variant text-sm mb-5">
                                    Provide official information about your NGO entity.
                                </p>
                                <hr className="border-outline-variant mb-6" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-bold text-on-surface mb-1.5">
                                            Organization Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Global Relief Fund"
                                            value={form.orgName}
                                            onChange={update("orgName")}
                                            className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-on-surface mb-1.5">
                                            Country of Registration
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={form.country}
                                                onChange={update("country")}
                                                className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm appearance-none pr-10"
                                            >
                                                <option value="">Select a country...</option>
                                                {COUNTRIES.map((c) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined text-on-surface-variant absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-lg">
                                                expand_more
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-on-surface mb-1.5">
                                            Registration Number / Tax ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter official ID"
                                            value={form.regNumber}
                                            onChange={update("regNumber")}
                                            className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-on-surface mb-1.5">
                                            Website{" "}
                                            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full ml-1">
                                                Optional
                                            </span>
                                        </label>
                                        <input
                                            type="url"
                                            placeholder="https://"
                                            value={form.website}
                                            onChange={update("website")}
                                            className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <label className="block text-sm font-bold text-on-surface mb-0.5">
                                        Description of Operations
                                    </label>
                                    <p className="text-xs text-on-surface-variant mb-1.5">
                                        Briefly describe your main humanitarian focus areas and regions of operation.
                                    </p>
                                    <textarea
                                        placeholder="Describe your NGO's mission and impact..."
                                        value={form.description}
                                        onChange={update("description")}
                                        rows={4}
                                        className="w-full px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm resize-none"
                                    ></textarea>
                                </div>
                            </div>

                            {/* Nav buttons */}
                            <div className="flex justify-between mb-10">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-2 px-6 py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-surface-container-low transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform"
                                >
                                    Continue
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Document Uploads ── */}
                    {step === 3 && (
                        <>
                            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 mb-6">
                                <h2 className="text-2xl font-extrabold text-primary mb-1">
                                    Document Uploads
                                </h2>
                                <p className="text-on-surface-variant text-sm mb-5">
                                    Upload official documents for verification.
                                </p>
                                <hr className="border-outline-variant mb-6" />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {[
                                        { key: "regCertificate", label: "Registration Certificate" },
                                        { key: "taxId", label: "Tax ID Document" },
                                        { key: "proofOfOperation", label: "Proof of Operation" },
                                    ].map((doc) => (
                                        <label
                                            key={doc.key}
                                            className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center ${files[doc.key]
                                                    ? "border-primary bg-primary-fixed/20"
                                                    : "border-outline-variant bg-surface-container-low hover:border-outline"
                                                }`}
                                        >
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleFile(doc.key)}
                                                className="hidden"
                                            />
                                            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">
                                                {files[doc.key] ? "check_circle" : "upload_file"}
                                            </span>
                                            <span className="text-sm font-bold text-primary mb-1">
                                                {doc.label}
                                            </span>
                                            <span className="text-[11px] text-on-surface-variant">
                                                {files[doc.key]
                                                    ? files[doc.key].name
                                                    : "PDF, JPG, PNG (max 10MB)"}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between mb-10">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex items-center gap-2 px-6 py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-surface-container-low transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(4)}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform"
                                >
                                    Continue
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 4: Review ── */}
                    {step === 4 && (
                        <>
                            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 mb-6">
                                <h2 className="text-2xl font-extrabold text-primary mb-1">
                                    Review Application
                                </h2>
                                <p className="text-on-surface-variant text-sm mb-5">
                                    Please confirm all details are correct before submitting.
                                </p>
                                <hr className="border-outline-variant mb-6" />

                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between border-b border-outline-variant/50 pb-3">
                                        <span className="text-on-surface-variant">Organization</span>
                                        <span className="font-bold text-primary">{form.orgName || "—"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-outline-variant/50 pb-3">
                                        <span className="text-on-surface-variant">Country</span>
                                        <span className="font-bold text-primary">{form.country || "—"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-outline-variant/50 pb-3">
                                        <span className="text-on-surface-variant">Registration #</span>
                                        <span className="font-bold text-primary font-mono">{form.regNumber || "—"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-outline-variant/50 pb-3">
                                        <span className="text-on-surface-variant">Website</span>
                                        <span className="font-bold text-primary">{form.website || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-outline-variant/50 pb-3">
                                        <span className="text-on-surface-variant">Wallet</span>
                                        <span className="font-bold text-primary font-mono">{shortAddr}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-on-surface-variant">Documents</span>
                                        <span className="font-bold text-primary">
                                            {Object.values(files).filter(Boolean).length} / 3 uploaded
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {applyMutation.isError && (
                                <div className="bg-error-container border border-error rounded-xl px-4 py-3 mb-4">
                                    <p className="text-sm text-on-error-container">{applyMutation.error?.message || "Submission failed"}</p>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex items-center gap-2 px-6 py-2.5 border border-outline-variant rounded-full text-sm font-bold text-primary hover:bg-surface-container-low transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={applyMutation.isPending}
                                    className="flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-bold active:scale-95 transition-transform disabled:opacity-60"
                                >
                                    {applyMutation.isPending ? "Submitting…" : "Submit Application"}
                                    <span className="material-symbols-outlined text-lg">send</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Upcoming Documents Preview (visible on step 2) ── */}
                    {step === 2 && (
                        <div className="mt-4">
                            <h3 className="text-xl font-bold text-primary mb-4">
                                Upcoming: Document Uploads
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {["Registration Certificate", "Tax ID Document", "Proof of Operation"].map(
                                    (doc) => (
                                        <div
                                            key={doc}
                                            className="flex flex-col items-center p-5 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low text-center"
                                        >
                                            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">
                                                upload_file
                                            </span>
                                            <span className="text-sm font-bold text-primary mb-1">{doc}</span>
                                            <span className="text-[11px] text-on-surface-variant">
                                                PDF, JPG, PNG (max 10MB)
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
