import { useEffect, useRef } from "react";

export function useFillRemainingHeight<T extends HTMLElement = HTMLDivElement>(offset?: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const top = el.getBoundingClientRect().top;
      el.style.height = `calc(100dvh - ${top + (offset || 0)}px)`;
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [offset]);

  return ref;
}
