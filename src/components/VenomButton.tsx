"use client";

import { useEffect, useRef } from "react";
import { bus } from "@/lib/bus";
import { useExperience } from "./Experience";

type Handle = { setHover: (v: boolean) => void; burst: () => void; destroy: () => void };

interface Props {
  children: React.ReactNode;
  className?: string;
  href?: string;
  venom?: boolean;
  onActivate?: (el: HTMLElement, burst: () => void) => void;
}

/** A button (or link) whose edges grow living ink tendrils that reach for the cursor. */
export default function VenomButton({ children, className = "", href, venom, onActivate }: Props) {
  const { touch, ready } = useExperience();
  const ref = useRef<HTMLElement | null>(null);
  const handle = useRef<Handle | null>(null);

  useEffect(() => {
    if (!ready || !bus.ink || !ref.current) return;
    const h = bus.ink.attach(ref.current, touch);
    handle.current = h;
    return () => {
      h.destroy();
      handle.current = null;
    };
  }, [touch, ready]);

  const common = {
    className: `venom-btn ${className}`,
    "data-venom": venom ? "" : undefined,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") handle.current?.setHover(true);
    },
    onPointerLeave: () => handle.current?.setHover(false),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) handle.current?.setHover(true);
    },
    onBlur: () => handle.current?.setHover(false),
  };

  if (href) {
    return (
      <a ref={ref as React.RefObject<HTMLAnchorElement>} href={href} {...common}>
        <span>{children}</span>
      </a>
    );
  }
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      {...common}
      onClick={(e) => onActivate?.(e.currentTarget, () => handle.current?.burst())}
    >
      <span>{children}</span>
    </button>
  );
}
