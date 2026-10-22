"use client";

import { motion } from "framer-motion";

// 서버 페이지에서도 쓸 수 있는 진입 애니메이션 래퍼
export default function FadeIn({ children, y = 0, duration = 0.5, delay = 0, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
