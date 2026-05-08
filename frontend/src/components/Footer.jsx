const PLATFORM_LINKS = [
  { label: "Browse Pools", href: "#/pools" },
  { label: "Transparency", href: "#transparency" },
  { label: "Impact Reports", href: "#impact" },
  { label: "NGO Portal", href: "#" },
];

const COMPANY_LINKS = [
  { label: "Methodology", href: "#methodology" },
  { label: "Partnerships", href: "#" },
  { label: "Annual Report", href: "#" },
  { label: "Privacy Protocol", href: "#" },
];

const TECH_LINKS = [
  { label: "Blockchain Ledger", href: "#" },
  { label: "Service Terms", href: "#" },
  { label: "Smart Contracts", href: "#" },
  { label: "Polygon Explorer", href: "https://polygonscan.com" },
];

export default function Footer() {
  return (
    <footer className="bg-surface-container-highest mt-xl">
      <div className="max-w-container-max mx-auto px-gutter py-xl flex flex-col md:flex-row justify-between items-start gap-lg">
        {/* Brand */}
        <div className="max-w-sm">
          <div className="text-2xl font-bold text-primary mb-md">
            AidChain
          </div>
          <p className="text-on-surface-variant text-base leading-relaxed">
            Empowerment through radical transparency. Harnessing the power of
            the Polygon blockchain to revolutionize humanitarian delivery.
          </p>
          <div className="flex gap-md mt-lg">
            <a className="text-primary hover:text-secondary transition-colors" href="#">
              <span className="material-symbols-outlined">public</span>
            </a>
            <a className="text-primary hover:text-secondary transition-colors" href="#">
              <span className="material-symbols-outlined">share</span>
            </a>
            <a className="text-primary hover:text-secondary transition-colors" href="#">
              <span className="material-symbols-outlined">forum</span>
            </a>
          </div>
        </div>

        {/* Link Columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-xl">
          <FooterColumn title="Platform" links={PLATFORM_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Tech" links={TECH_LINKS} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-container-max mx-auto px-gutter py-md border-t border-outline-variant flex flex-col md:flex-row justify-between items-center text-xs text-on-surface-variant opacity-80 gap-2">
        <span>© {new Date().getFullYear()} AidChain. Empowerment through radical transparency.</span>
        <span className="font-mono">
          Network: Polygon
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h4 className="font-bold text-primary mb-md">{title}</h4>
      <ul className="space-y-sm text-on-surface-variant text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <a
              className="hover:text-primary transition-colors"
              href={link.href}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
