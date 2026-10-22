"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionTemplate } from "framer-motion";
import ContactOverlay from "./ContactOverlay";

// ---------------------------------------------------------------------------
// 이미지 데이터 — 원본 비율과 위치 오프셋
// ---------------------------------------------------------------------------

const HERO_PHOTOS = [
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80",
  "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&q=80",
  "https://images.unsplash.com/photo-1520420097861-e4959843b682?w=600&q=80",
  "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=600&q=80",
  "https://images.unsplash.com/photo-1482160549825-59d1b23cb208?w=600&q=80",
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80",
  "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80",
  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&q=80",
  "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=600&q=80",
  "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=600&q=80",
  "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&q=80",
  "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=600&q=80",
];

// parallax: 개별 패럴랙스 크기(vw), null = 없음
// parallaxPositive: true면 그리드와 같은 방향, false면 반대 방향
const IMAGES = [
  { id: 1, w: 633, h: 944, top: "-5.4vw", left: "-7.6vw", parallax: 1, parallaxPositive: false },
  { id: 2, w: 705, h: 489, top: "7.1vw", left: "-6.8vw", parallax: null, parallaxPositive: true },
  { id: 3, w: 523, h: 781, top: "-7vw", left: "2vw", parallax: 2, parallaxPositive: false },
  { id: 4, w: 523, h: 784, top: "4.2vw", left: "-2.1vw", parallax: null, parallaxPositive: true },
  { id: 5, w: 523, h: 784, top: "-8.7vw", left: "-2.1vw", parallax: 4, parallaxPositive: true },
  { id: 6, w: 507, h: 761, top: "9.2vw", left: "-4.3vw", parallax: 2, parallaxPositive: true },
  { id: 7, w: 451, h: 676, top: "-11.1vw", left: "10.4vw", parallax: 2, parallaxPositive: true },
  { id: 8, w: 375, h: 563, top: "-3.7vw", left: "13.2vw", parallax: 5, parallaxPositive: true },
  { id: 9, w: 523, h: 784, top: "-9vw", left: "-10.6vw", parallax: null, parallaxPositive: true },
  { id: 10, w: 422, h: 632, top: "7.1vw", left: "1.8vw", parallax: 2, parallaxPositive: false },
  { id: 11, w: 523, h: 370, top: "-8.2vw", left: "0.7vw", parallax: 3, parallaxPositive: true },
  { id: 12, w: 423, h: 620, top: "5.4vw", left: "3.3vw", parallax: null, parallaxPositive: true },
];

// Lerp — Webflow smoothing 97 (factor 0.03) 재현
const LERP_FACTOR = 0.03;
const lerp = (current, target) => current + (target - current) * LERP_FACTOR;

// 마우스 X에 따라 바뀌는 배경색
const COLOR_STOPS = [
  { at: 0, r: 213, g: 28, b: 28 },
  { at: 33, r: 131, g: 2, b: 2 },
  { at: 66, r: 99, g: 14, b: 14 },
  { at: 100, r: 155, g: 43, b: 52 },
];

function interpolateColor(t) {
  const pct = t * 100;
  let i = 0;
  for (; i < COLOR_STOPS.length - 1; i++) {
    if (pct <= COLOR_STOPS[i + 1].at) break;
  }
  const a = COLOR_STOPS[i];
  const b = COLOR_STOPS[Math.min(i + 1, COLOR_STOPS.length - 1)];
  const range = b.at - a.at || 1;
  const f = (pct - a.at) / range;
  const r = Math.round(a.r + (b.r - a.r) * f);
  const g = Math.round(a.g + (b.g - a.g) * f);
  const bl = Math.round(a.b + (b.b - a.b) * f);
  return `rgb(${r},${g},${bl})`;
}

export default function HeroSection({ gridInView = false }) {
  const sectionRef = useRef(null);
  const rafRef = useRef(0);

  // 마우스 상태 (0~1 정규화, 기본 0.5)
  const mouseTarget = useRef({ x: 0.5, y: 0.5 });
  const mouseCurrent = useRef({ x: 0.5, y: 0.5 });

  const gridRef = useRef(null);
  const imgRefs = useRef(new Map());

  // 그리드 인트로: opacity 0→1, scale 0.8→1, 800ms 지연, 1400ms
  const introStartTime = useRef(null);
  const introScale = useRef(0.8);
  const introOpacity = useRef(0);
  const introDone = useRef(false);

  const [buttonHovered, setButtonHovered] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const colorBgRef = useRef(null);

  // 스크롤 패럴랙스
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, { damping: 50, stiffness: 20, restDelta: 0.0001 });

  const imgY = useTransform(smoothProgress, [0, 1], ["0%", "-250%"]);
  const imgScale = useTransform(smoothProgress, [0, 1], [1, 1.3]);
  const imgBlur = useTransform(smoothProgress, [0, 1], [0, 30]);
  const imgOpacity = useTransform(smoothProgress, [0, 1], [1, 0]);
  const filterBlur = useMotionTemplate`blur(${imgBlur}px)`;

  const handleMouseMove = useCallback((e) => {
    mouseTarget.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  useEffect(() => {
    // 터치 기기에서는 마우스 패럴랙스 생략
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mql.matches) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // RAF 루프: 마우스 패럴랙스 + 그리드 인트로
  useEffect(() => {
    function tick(timestamp) {
      if (!introDone.current) {
        if (introStartTime.current === null) introStartTime.current = timestamp;
        const elapsed = timestamp - introStartTime.current;
        const DELAY = 800;
        const DURATION = 1400;

        if (elapsed < DELAY) {
          introScale.current = 0.8;
          introOpacity.current = 0;
        } else {
          const t = Math.min((elapsed - DELAY) / DURATION, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          introScale.current = 0.8 + 0.2 * eased;
          introOpacity.current = eased;
          if (t >= 1) introDone.current = true;
        }
      }

      const prev = mouseCurrent.current;
      const target = mouseTarget.current;
      const nx = lerp(prev.x, target.x);
      const ny = lerp(prev.y, target.y);
      mouseCurrent.current = { x: nx, y: ny };

      // 그리드: [0,1] -> [+20, -20] vw
      const gridX = 20 - nx * 40;
      const gridY = 20 - ny * 40;

      if (gridRef.current) {
        const s = introScale.current;
        gridRef.current.style.transform = `translate3d(${gridX}vw, ${gridY}vw, 0px) scale3d(${s}, ${s}, 1)`;
        gridRef.current.style.opacity = String(introOpacity.current);
      }

      imgRefs.current.forEach((el, id) => {
        const img = IMAGES.find((i) => i.id === id);
        if (!img || img.parallax === null) return;
        const mag = img.parallax;
        const sign = img.parallaxPositive ? 1 : -1;
        const ix = sign * (mag - nx * mag * 2);
        const iy = sign * (mag - ny * mag * 2);
        el.style.transform = `translate3d(${ix}vw, ${iy}vw, 0)`;
      });

      if (colorBgRef.current) {
        colorBgRef.current.style.backgroundColor = interpolateColor(nx);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const setImgRef = useCallback(
    (id) => (el) => {
      if (el) imgRefs.current.set(id, el);
      else imgRefs.current.delete(id);
    },
    []
  );

  return (
    <>
      {/* 버튼 호버 시 나타나는 고정 배경 */}
      <div ref={colorBgRef} className="hero-color-bg" style={{ opacity: buttonHovered ? 1 : 0 }} />

      {/* 히어로 섹션 — 250vh */}
      <div ref={sectionRef} className="hero">
        <div className="hero-sticky">
          {/* 1. 텍스트 레이어 */}
          <div className="hero-text">
            <motion.div
              className="clip"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              transition={{ delay: 0.1, duration: 0.7, ease: "easeInOut" }}
            >
              <div className="hero-title-wrap">
                <h1 className="hero-title">Parallax artist portfolio</h1>
              </div>
            </motion.div>

            <motion.div
              className="hero-sub clip"
              initial={{ height: 0 }}
              animate={{ height: gridInView ? 0 : "auto" }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="hero-divider">
                <div />
              </div>

              <h5 className="hero-subtitle">Motion-rich portfolio for artists</h5>

              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="pill pill--dark"
                onMouseEnter={() => setButtonHovered(true)}
                onMouseLeave={() => setButtonHovered(false)}
              >
                Let's connect
              </button>
            </motion.div>
          </div>

          {/* 2. 이미지 블록 */}
          <motion.div
            className="hero-img-block"
            style={{ y: imgY, scale: imgScale, opacity: imgOpacity, filter: filterBlur }}
          >
            <div ref={gridRef} className="hero-grid">
              {IMAGES.map((img) => (
                <div key={img.id} ref={setImgRef(img.id)} className="hero-img-cell">
                  <img
                    src={HERO_PHOTOS[img.id - 1]}
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    className="hero-img"
                    style={{ aspectRatio: `${img.w}/${img.h}`, top: img.top, left: img.left }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* 3. 스크롤 인디케이터 */}
          <motion.div
            className="hero-scroll clip"
            initial={{ opacity: 0, height: "auto" }}
            animate={{ opacity: gridInView ? 0 : 1, height: gridInView ? 0 : "auto" }}
            transition={{
              opacity: { duration: gridInView ? 0.4 : 0.7, delay: gridInView ? 0 : 0.1, ease: "easeOut" },
              height: { duration: 0.4, ease: "easeInOut" },
            }}
          >
            <div className="hero-scroll-track">
              <motion.div
                className="hero-scroll-line"
                animate={{ y: ["-100%", "-100%", "100%", "-120%"] }}
                transition={{
                  duration: 2.1,
                  times: [0, 0.33, 0.66, 0.67],
                  ease: ["easeInOut", "easeInOut", "easeInOut", "linear"],
                  repeat: Infinity,
                  repeatDelay: 0,
                }}
              />
            </div>

            <motion.span
              className="hero-scroll-text"
              animate={{
                color: ["rgba(18,18,17,0.4)", "rgba(18,18,17,0.4)", "rgba(18,18,17,1)", "rgba(18,18,17,0.4)"],
              }}
              transition={{ duration: 2.1, times: [0, 0.33, 0.66, 0.67], ease: "easeInOut", repeat: Infinity }}
            >
              Scroll
            </motion.span>
          </motion.div>
        </div>
      </div>
      <ContactOverlay open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
