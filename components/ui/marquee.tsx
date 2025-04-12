"use client";
import { cn } from "@/lib/utils";
import React, { ComponentPropsWithoutRef, CSSProperties, forwardRef } from "react";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  direction?: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  gap?: "sm" | "md" | "lg";
  pauseOnHover?: boolean;
  maskEdges?: boolean;
}

const Marquee = forwardRef<HTMLDivElement, MarqueeProps>(({ className, speed = "normal", direction = "left", gap = "md", pauseOnHover = false, maskEdges = false, children, ...props }, ref) => {
  const speedVar = speed === "slow" ? "30s" : speed === "normal" ? "20s" : "10s";
  const directionVar = direction === "left" ? "forwards" : "reverse";
  return (
    <div
      ref={ref}
      className={cn("overflow-clip", className, {
        "hover:[&>div]:[animation-play-state:paused]": pauseOnHover,
        "mask-edges-sm": maskEdges,
      })}
      style={
        {
          "--speed": speedVar,
          "--direction": directionVar,
        } as CSSProperties
      }
      {...props}
    >
      <div
        className={cn("flex w-max animate-marquee-move", {
          "gap-2 pl-2": gap === "sm",
          "gap-4 pl-4": gap === "md",
          "gap-6 pl-6": gap === "lg",
        })}
      >
        {children}
      </div>
    </div>
  );
});

Marquee.displayName = "Marquee";

export default Marquee;
