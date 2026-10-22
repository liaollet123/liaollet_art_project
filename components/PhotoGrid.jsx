"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { artworks } from "@/lib/artworks";

const COL_1_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const COL_2_IDS = [10, 11, 12, 13, 14, 15, 16, 17];
const COL_3_IDS = [18, 19, 20, 21, 22, 23, 24, 25];

const getByIds = (ids) => ids.map((id) => artworks.find((a) => a.id === id));

function FadeUpOnScroll({ children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0, margin: "100% 0px 100% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

function PhotoColumn({ photos, startDelay }) {
  return (
    <div className="photo-col">
      {photos.map((photo, i) => (
        <FadeUpOnScroll key={photo.id} delay={i % 2 === 0 ? startDelay : startDelay + 0.1}>
          <Link href={`/artwork/${photo.slug}`} className="photo-link">
            <img
              src={photo.image}
              alt={photo.title}
              className="photo-img"
              style={{ aspectRatio: `${photo.w}/${photo.h}` }}
              loading="lazy"
            />
          </Link>
        </FadeUpOnScroll>
      ))}
    </div>
  );
}

export default function PhotoGrid() {
  return (
    <section className="photo-grid">
      <div className="photo-grid-row">
        <PhotoColumn photos={getByIds(COL_1_IDS)} startDelay={0.2} />
        <PhotoColumn photos={getByIds(COL_2_IDS)} startDelay={0.3} />
        <PhotoColumn photos={getByIds(COL_3_IDS)} startDelay={0.2} />
      </div>
    </section>
  );
}
