"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "./Icons";

export default function ContactOverlay({ open, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const closeBtnRef = useRef(null);
  const previousFocus = useRef(null);
  const uid = useId();
  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const messageId = `${uid}-message`;

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="overlay overlay--light"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-title`}
        >
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close contact form"
            className="overlay-close icon-btn"
          >
            <XIcon size={28} />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="contact-panel"
          >
            <h2 id={`${uid}-title`} className="contact-title">
              Get in touch
            </h2>

            {submitted ? (
              <p className="form-thanks">Thank you for reaching out. We'll be in touch soon.</p>
            ) : (
              <form onSubmit={handleSubmit} className="line-form">
                <div>
                  <label htmlFor={nameId}>
                    Name <span className="req">*</span>
                  </label>
                  <input id={nameId} required type="text" name="name" placeholder="Your name" maxLength={100} />
                </div>
                <div>
                  <label htmlFor={emailId}>
                    Email <span className="req">*</span>
                  </label>
                  <input id={emailId} required type="email" name="email" placeholder="your@email.com" maxLength={255} />
                </div>
                <div>
                  <label htmlFor={messageId}>Message</label>
                  <textarea
                    id={messageId}
                    name="message"
                    rows={4}
                    maxLength={1000}
                    placeholder="Tell us about your interest..."
                  />
                </div>
                <button type="submit" className="solid-btn">
                  Send
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
