import type Lenis from "lenis";
import type { Ink } from "./ink";
import type { Water } from "./water";

/** The live engines. Mutable on purpose: these are imperative renderers, not React state. */
export const bus: { ink: Ink | null; water: Water | null; lenis: Lenis | null } = { ink: null, water: null, lenis: null };
