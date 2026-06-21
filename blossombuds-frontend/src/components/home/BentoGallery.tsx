import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { X } from "lucide-react";

export type BentoItem = {
  id: number | string;
  title: string;
  desc: string;
  url: string;
  span?: number; // 1 (default) or 2 (double-wide card)
};

export interface BentoGalleryProps {
  items: BentoItem[];
  title: string;
  description: string;
  eyebrow?: string;
  sectionBg?: string;
}

/* ── Animation variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 16 },
  },
};

/* ── Modal ──────────────────────────────────────────────────── */
function ImageModal({
  item,
  onClose,
}: {
  item: BentoItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bento-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <motion.div
        initial={{ scale: 0.92, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 28 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="bento-modal-inner"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={item.url}
          alt={item.title}
          className="bento-modal-img"
        />
        <div className="bento-modal-caption">
          <p className="bento-modal-title">{item.title}</p>
          {item.desc && (
            <p className="bento-modal-desc">{item.desc}</p>
          )}
        </div>
      </motion.div>

      <button
        className="bento-modal-close"
        onClick={onClose}
        aria-label="Close image view"
      >
        <X size={20} />
      </button>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function BentoGallery({
  items,
  title,
  description,
  eyebrow,
  sectionBg = "#F5F0E8",
}: BentoGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<BentoItem | null>(null);
  const [dragConstraint, setDragConstraint] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isDragging = useRef(false);

  /* Recalculate max drag distance on mount + resize */
  useEffect(() => {
    const calc = () => {
      if (gridRef.current && containerRef.current) {
        const cw = containerRef.current.offsetWidth;
        const gw = gridRef.current.scrollWidth;
        setDragConstraint(Math.min(0, cw - gw - 24));
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [items]);

  /* Scroll-driven header animation */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const headerOpacity = useTransform(
    scrollYProgress,
    [0, 0.12, 0.88, 1],
    [0, 1, 1, 0]
  );
  const headerY = useTransform(scrollYProgress, [0, 0.18], [28, 0]);

  if (!items.length) return null;

  return (
    <section
      ref={sectionRef}
      className="bento-section"
      style={{ background: sectionBg }}
    >
      <style>{styles}</style>

      {/* Header */}
      <motion.div
        style={{ opacity: headerOpacity, y: headerY }}
        className="bento-header"
      >
        {eyebrow && <span className="bento-eyebrow">{eyebrow}</span>}
        <h2 className="bento-title">{title}</h2>
        <p className="bento-desc">{description}</p>
      </motion.div>

      {/* Horizontal drag gallery */}
      <div ref={containerRef} className="bento-drag-area">
        <motion.div
          style={{ width: "max-content" }}
          drag="x"
          dragConstraints={{ left: dragConstraint, right: 0 }}
          dragElastic={0.06}
          dragMomentum
          onDragStart={() => {
            isDragging.current = true;
          }}
          onDragEnd={() => {
            // Small delay so the click handler fires after this flag
            setTimeout(() => {
              isDragging.current = false;
            }, 50);
          }}
        >
          <motion.div
            ref={gridRef}
            className="bento-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12 }}
          >
            {items.map((item) => (
              <motion.article
                key={item.id}
                variants={itemVariants}
                className="bento-item"
                data-wide={item.span === 2 ? "true" : undefined}
                onClick={() => {
                  if (!isDragging.current) setSelectedItem(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedItem(item);
                  }
                }}
                tabIndex={0}
                aria-label={`View ${item.title}`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="bento-item-img"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div className="bento-item-gradient" aria-hidden="true" />
                <div className="bento-item-copy">
                  <h3 className="bento-item-title">{item.title}</h3>
                  {item.desc && (
                    <p className="bento-item-desc">{item.desc}</p>
                  )}
                </div>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Drag hint */}
      <p className="bento-hint" aria-hidden="true">
        ← drag to explore →
      </p>

      {/* Lightbox modal */}
      <AnimatePresence>
        {selectedItem && (
          <ImageModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = `
/* ── Section ── */
.bento-section{
  position:relative;
  width:100%;
  overflow:hidden;
  padding:clamp(48px,7vw,88px) 0 clamp(32px,4vw,56px);
}

/* ── Header ── */
.bento-header{
  max-width:680px;
  margin:0 auto clamp(24px,4vw,44px);
  padding:0 clamp(16px,4vw,32px);
  text-align:center;
}

.bento-eyebrow{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:0 12px;
  margin-bottom:10px;
  border-radius:999px;
  background:rgba(240,93,139,.08);
  border:1px solid rgba(240,93,139,.14);
  color:#F05D8B;
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
}

.bento-title{
  margin:0 0 8px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(24px,3.2vw,38px);
  font-weight:400;
  color:#4A4F41;
  line-height:1.1;
}

.bento-desc{
  margin:0;
  color:#7a8277;
  font-size:14px;
  line-height:1.65;
}

/* ── Drag area ── */
.bento-drag-area{
  width:100%;
  position:relative;
  cursor:grab;
  -webkit-user-select:none;
  user-select:none;
}

.bento-drag-area:active{
  cursor:grabbing;
}

/* ── Grid ── */
.bento-grid{
  display:grid;
  grid-auto-flow:column;
  grid-auto-columns:minmax(240px,1fr);
  grid-template-rows:clamp(260px,28vw,380px);
  gap:14px;
  padding:0 clamp(12px,2vw,20px) 4px;
}

/* ── Item ── */
.bento-item{
  position:relative;
  display:flex;
  align-items:flex-end;
  overflow:hidden;
  border-radius:16px;
  cursor:pointer;
  min-width:240px;
  background:#2a2a2a;
  outline:none;
  transition:box-shadow .3s ease;
}

.bento-item:focus-visible{
  box-shadow:0 0 0 3px #F05D8B;
}

.bento-item[data-wide="true"]{
  grid-column:span 2;
  min-width:480px;
}

/* Image */
.bento-item-img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center;
  display:block;
  pointer-events:none;
  transition:transform .55s cubic-bezier(.22,.61,.36,1);
}

.bento-item:hover .bento-item-img{
  transform:scale(1.06);
}

/* Hover gradient overlay */
.bento-item-gradient{
  position:absolute;
  inset:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,.84) 0%,
    rgba(0,0,0,.38) 44%,
    transparent 70%
  );
  opacity:0;
  transition:opacity .4s ease;
  pointer-events:none;
}

.bento-item:hover .bento-item-gradient{
  opacity:1;
}

/* Text reveal on hover */
.bento-item-copy{
  position:relative;
  z-index:2;
  padding:16px 18px;
  transform:translateY(10px);
  opacity:0;
  transition:transform .4s ease, opacity .4s ease;
}

.bento-item:hover .bento-item-copy{
  transform:translateY(0);
  opacity:1;
}

.bento-item-title{
  margin:0 0 4px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(13px,1.3vw,18px);
  font-weight:400;
  color:#fff;
  line-height:1.2;
}

.bento-item-desc{
  margin:0;
  font-size:12px;
  color:rgba(255,255,255,.70);
  line-height:1.5;
}

/* ── Drag hint ── */
.bento-hint{
  text-align:center;
  margin:12px 0 0;
  font-size:11px;
  letter-spacing:.1em;
  color:rgba(74,79,65,.38);
}

/* ── Modal backdrop ── */
.bento-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:200;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,.84);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
}

/* ── Modal inner ── */
.bento-modal-inner{
  position:relative;
  width:100%;
  max-width:1000px;
  padding:16px;
  display:flex;
  flex-direction:column;
  gap:12px;
}

.bento-modal-img{
  display:block;
  width:100%;
  height:auto;
  max-height:84vh;
  border-radius:14px;
  object-fit:contain;
}

.bento-modal-caption{
  padding:0 4px;
}

.bento-modal-title{
  margin:0 0 2px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:20px;
  font-weight:400;
  color:#fff;
  line-height:1.2;
}

.bento-modal-desc{
  margin:0;
  font-size:13px;
  color:rgba(255,255,255,.60);
  line-height:1.5;
}

/* ── Modal close button ── */
.bento-modal-close{
  position:fixed;
  top:20px;
  right:20px;
  z-index:201;
  display:flex;
  align-items:center;
  justify-content:center;
  width:44px;
  height:44px;
  border:none;
  background:rgba(255,255,255,.14);
  border-radius:50%;
  color:#fff;
  cursor:pointer;
  transition:background .2s ease;
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
}

.bento-modal-close:hover{
  background:rgba(255,255,255,.26);
}

@media (prefers-reduced-motion:reduce){
  .bento-item-img,
  .bento-item-gradient,
  .bento-item-copy{
    transition:none;
  }
}
`;
