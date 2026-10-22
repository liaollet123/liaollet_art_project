"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MenuIcon } from "./Icons";
import NavOverlay from "./NavOverlay";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <header className="site-header">
        <Link href="/" className="site-logo">
          A.S.
        </Link>

        <button onClick={() => setMenuOpen(true)} className="icon-btn site-menu-btn" aria-label="Open menu">
          <MenuIcon size={24} />
        </button>
      </header>

      <NavOverlay open={menuOpen} onClose={close} />
    </>
  );
}
