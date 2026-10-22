"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ContactOverlay from "./ContactOverlay";

const NAV_LINKS = [
  { label: "Home", to: "/", type: "link" },
  { label: "Portfolio", to: "/portfolio", type: "link" },
  { label: "About", to: "/about", type: "link" },
  { label: "Contact", to: "", type: "contact" },
  { label: "Instagram", to: "https://instagram.com", type: "external" },
];

function NavPillLink({ children, onClick, to, type, onClose }) {
  if (type === "external") {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" onClick={onClose} className="pill pill--light">
        {children}
      </a>
    );
  }

  if (type === "contact") {
    return (
      <button onClick={onClick} className="pill pill--light">
        {children}
      </button>
    );
  }

  return (
    <Link href={to || "/"} onClick={onClose} className="pill pill--light">
      {children}
    </Link>
  );
}

export default function NavOverlay({ open, onClose }) {
  const [contactOpen, setContactOpen] = useState(false);
  const closeBtnRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    closeBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  const handleContactClick = () => {
    onClose();
    setTimeout(() => setContactOpen(true), 300);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="overlay overlay--dark"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <button ref={closeBtnRef} onClick={onClose} aria-label="Close menu" className="overlay-close nav-close">
              Close
            </button>

            <nav className="nav-list">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                >
                  <NavPillLink
                    type={link.type}
                    to={link.to}
                    onClick={link.type === "contact" ? handleContactClick : undefined}
                    onClose={onClose}
                  >
                    {link.label}
                  </NavPillLink>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <ContactOverlay open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
