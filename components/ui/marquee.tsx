"use client";
import { cn } from "@/lib/utils";
import React, { ComponentPropsWithoutRef, CSSProperties, forwardRef, useEffect, useRef, useState } from "react";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  direction?: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  gap?: "sm" | "md" | "lg";
  pauseOnHover?: boolean;
  maskEdges?: boolean;
}

const BASE_SPEED = 50; // pixels per second

const Marquee = forwardRef<HTMLDivElement, MarqueeProps>(({ className, speed = "normal", direction = "left", gap = "md", pauseOnHover = false, maskEdges = false, children, ...props }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<string>("90s");

  useEffect(() => {
    const calculateDuration = () => {
      if (!contentRef.current) return;
      const contentWidth = contentRef.current.scrollWidth / 2; // Divide by 2 because content is duplicated
      const speedMultiplier = speed === "slow" ? 0.5 : speed === "normal" ? 1 : 2;
      const durationInSeconds = contentWidth / (BASE_SPEED * speedMultiplier);
      setDuration(`${durationInSeconds}s`);
    };

    calculateDuration();
    window.addEventListener("resize", calculateDuration);
    return () => window.removeEventListener("resize", calculateDuration);
  }, [speed]);

  const directionVar = direction === "left" ? "forwards" : "reverse";

  return (
    <div
      ref={ref}
      className={cn("overflow-clip", className, {
        "[&>div]:hover:[animation-play-state:paused]": pauseOnHover,
        "mask-edges-sm": maskEdges,
      })}
      style={
        {
          "--speed": duration,
          "--direction": directionVar,
        } as CSSProperties
      }
      {...props}
    >
      <div
        ref={contentRef}
        className={cn("flex w-max animate-marquee-move", {
          "gap-2 pl-2": gap === "sm",
          "gap-4 pl-4": gap === "md",
          "gap-6 pl-6": gap === "lg",
        })}
      >
        {children}
        {children}
      </div>
    </div>
  );
});

Marquee.displayName = "Marquee";

export default Marquee;
