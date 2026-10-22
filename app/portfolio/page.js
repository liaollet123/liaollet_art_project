"use client";

// 원본의 Index.tsx (패럴랙스 포트폴리오 메인) — 원본에서는 라우트에 연결되어 있지 않아 /portfolio 로 둠
import { useRef } from "react";
import { useInView } from "framer-motion";
import SiteHeader from "@/components/SiteHeader";
import HeroSection from "@/components/HeroSection";
import PhotoGrid from "@/components/PhotoGrid";

export default function PortfolioPage() {
  const gridRef = useRef(null);
  const gridInView = useInView(gridRef, { margin: "100% 0px 100% 0px" });

  return (
    <div className="portfolio">
      <SiteHeader />
      <HeroSection gridInView={gridInView} />
      <div ref={gridRef}>
        <PhotoGrid />
      </div>
    </div>
  );
}
