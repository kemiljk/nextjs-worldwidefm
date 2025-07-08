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

const Marquee = forwardRef<HTMLDivElement, MarqueeProps>(({ className, speed = "normal", direction = "left", gap = "md", pauseOnHover = false, maskEdges = false, children, ...props }, ref) => {
  const [isPaused, setIsPaused] = useState(false);

  // Fixed durations for consistent speeds
  const getDuration = () => {
    switch (speed) {
      case "slow":
        return "120s"; // 2 minutes for slow
      case "fast":
        return "30s"; // 30 seconds for fast
      default:
        return "60s"; // 1 minute for normal
    }
  };

  const duration = getDuration();

  const directionVar = direction === "left" ? "forwards" : "reverse";

  // Debug logging
  console.log(`Marquee speed: ${speed}, duration: ${duration}`);

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  };

  return (
    <div
      ref={ref}
      className={cn("overflow-clip", className, {
        "mask-edges-sm": maskEdges,
      })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <div
        className={cn("flex w-max", {
          "gap-2 pl-2": gap === "sm",
          "gap-4 pl-4": gap === "md",
          "gap-6 pl-6": gap === "lg",
        })}
        style={{
          animation: `marquee-move-text ${duration} linear infinite ${directionVar}`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {children}
        {children}
      </div>
    </div>
  );
});

Marquee.displayName = "Marquee";

export default Marquee;
