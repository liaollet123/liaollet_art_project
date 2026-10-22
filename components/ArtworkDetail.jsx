"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useId, useState } from "react";
import SiteHeader from "./SiteHeader";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "./Icons";

export default function ArtworkDetail({ artwork, prev, next }) {
  const [submitted, setSubmitted] = useState(false);
  const uid = useId();
  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const remarksId = `${uid}-remarks`;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="hero-page artwork"
    >
      <SiteHeader />

      {/* 모바일 닫기 버튼 */}
      <Link href="/" aria-label="Back to home" className="artwork-close icon-btn">
        <XIcon size={28} />
      </Link>

      <div className="artwork-split">
        {/* 왼쪽: 이미지 */}
        <div className="artwork-media">
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            src={artwork.image}
            alt={artwork.title}
          />
        </div>

        {/* 오른쪽: 정보 + 문의 폼 */}
        <div className="artwork-info">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <div className="artwork-meta">
              <p className="artwork-title">{artwork.title}</p>
              <p>
                {artwork.medium} ({artwork.year})
              </p>
              <p>{artwork.dimensions}</p>
            </div>

            <p className="artwork-desc">{artwork.description}</p>

            <h2 className="artwork-form-title">Request artwork</h2>

            {submitted ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="form-thanks">
                Thank you for your inquiry. We&apos;ll be in touch soon.
              </motion.p>
            ) : (
              <form onSubmit={handleSubmit} className="line-form">
                <div>
                  <label htmlFor={nameId}>
                    Full name <span className="req">*</span>
                  </label>
                  <input id={nameId} required type="text" name="name" placeholder="Full name" maxLength={100} />
                </div>
                <div>
                  <label htmlFor={emailId}>
                    Email <span className="req">*</span>
                  </label>
                  <input id={emailId} required type="email" name="email" placeholder="Email" maxLength={255} />
                </div>
                <div>
                  <label htmlFor={remarksId}>Remarks</label>
                  <textarea
                    id={remarksId}
                    name="remarks"
                    rows={4}
                    maxLength={1000}
                    placeholder="Hi, I'm interested in purchasing this work. Could you please provide more information about the piece?"
                  />
                </div>
                <button type="submit" className="solid-btn">
                  Submit
                </button>
              </form>
            )}
          </motion.div>

          {/* 이전 / 다음 */}
          <div className="artwork-pager">
            {prev ? (
              <Link href={`/artwork/${prev.slug}`} className="pager-link pager-link--prev">
                <ArrowLeftIcon size={16} className="pager-arrow" />
                <span>
                  <span className="pager-label">Previous</span>
                  <span className="pager-title">{prev.title}</span>
                </span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link href={`/artwork/${next.slug}`} className="pager-link pager-link--next">
                <span>
                  <span className="pager-label">Next</span>
                  <span className="pager-title">{next.title}</span>
                </span>
                <ArrowRightIcon size={16} className="pager-arrow" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
