"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { bus } from "@/lib/bus";
import Empire from "./Empire";
import Dossiers from "./Dossiers";
import StageChapters from "./StageChapters";
import Syndicate from "./Syndicate";
import Finale from "./Finale";

export default function Under() {
  
  useEffect(() => {
    const ink = bus.ink;
    if (ink) {
      ink.accent = 1;
      ink.edgeScale = window.innerWidth < 700 ? 0.36 : 1;
      if (!ink.busy) ink.settle(true);
    }
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(t);
    };
  }, []);

  return (
    <main className="under">
      <Empire />
      <Dossiers />
      <StageChapters />
      <Syndicate />
      <Finale />
    </main>
  );
}
