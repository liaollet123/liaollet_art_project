import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="hero-page center-page">
      <SiteHeader />
      <div className="center-box">
        <p className="nf-code">404</p>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-text">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="text-link">
          Return home
        </Link>
      </div>
    </div>
  );
}
