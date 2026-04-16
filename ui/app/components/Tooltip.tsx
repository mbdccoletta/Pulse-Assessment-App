import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";

interface Props {
  text: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom";
  maxWidth?: number;
  containerStyle?: React.CSSProperties;
}

export const Tooltip: React.FC<Props> = ({ text, children, position = "top", maxWidth = 260, containerStyle }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const dk = useCurrentTheme() === "dark";

  useEffect(() => {
    if (show && ref.current) {
      requestAnimationFrame(() => {
        if (!ref.current || !tipRef.current) return;
        const r = ref.current.getBoundingClientRect();
        const t = tipRef.current.getBoundingClientRect();
        let left = r.left + r.width / 2 - t.width / 2;
        let top = position === "top" ? r.top - t.height - 8 : r.bottom + 8;
        if (left < 8) left = 8;
        if (left + t.width > window.innerWidth - 8) left = window.innerWidth - t.width - 8;
        if (top < 8) top = r.bottom + 8;
        setCoords({ left, top });
      });
    }
  }, [show, position]);

  const tooltipEl = show ? (
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: "fixed",
        left: coords?.left ?? -9999,
        top: coords?.top ?? -9999,
        maxWidth,
        padding: "12px 16px",
        borderRadius: 10,
        fontSize: 14,
        lineHeight: 1.7,
        fontWeight: 500,
        color: dk ? "#f0f0f8" : "#111122",
        background: dk ? "rgba(16,16,40,0.98)" : "rgba(255,255,255,0.98)",
        border: `1px solid ${dk ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}`,
        boxShadow: dk
          ? "0 6px 28px rgba(0,0,0,0.6)"
          : "0 6px 28px rgba(0,0,0,0.15)",
        zIndex: 10000,
        pointerEvents: "none",
        opacity: coords ? 1 : 0,
        transition: "opacity 0.15s",
      }}
    >
      {text}
    </div>
  ) : null;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => { setShow(false); setCoords(null); }}
      onFocus={() => setShow(true)}
      onBlur={() => { setShow(false); setCoords(null); }}
      style={{ display: "inline-flex", ...containerStyle }}
    >
      {children}
      {tooltipEl && createPortal(tooltipEl, document.body)}
    </div>
  );
};
