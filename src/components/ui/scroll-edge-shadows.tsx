import { useEffect, useState, type RefObject } from "react";

import { cn } from "@/lib/utils";

interface ScrollEdgeShadowsProps {
  scrollRef: RefObject<HTMLElement | null>;
  className?: string;
}

export function ScrollEdgeShadows({
  scrollRef,
  className,
}: ScrollEdgeShadowsProps) {
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
        setEdges({
          left: element.scrollLeft > 1,
          right: maxScroll - element.scrollLeft > 1,
        });
      });
    };

    update();
    element.addEventListener("scroll", update, { passive: true });

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    if (element.firstElementChild) resizeObserver.observe(element.firstElementChild);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollRef]);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-20 overflow-hidden", className)}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-foreground/15 to-transparent transition-opacity duration-150",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-foreground/15 to-transparent transition-opacity duration-150",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}