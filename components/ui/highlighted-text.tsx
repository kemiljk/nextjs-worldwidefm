import { cn } from "@/lib/utils";

interface HighlightedTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "white" | "custom";
  backgroundColor?: string;
  textColor?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ children, className = "", variant = "default", backgroundColor, textColor }) => {
  const baseClasses = "inline";

  const variantStyles = {
    default: {
      backgroundColor: "var(--color-almostblack)",
      color: "var(--color-white)",
    },
    white: {
      backgroundColor: "var(--color-white)",
      color: "var(--color-almostblack)",
    },
    custom: {
      backgroundColor: backgroundColor || "var(--color-almostblack)",
      color: textColor || "var(--color-white)",
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <span
      className={cn(baseClasses, className)}
      style={{
        padding: "0.15em 0.1em 0.15em 0.1em",
        backgroundColor: currentStyle.backgroundColor,
        outline: "1px solid var(--color-almostblack)",
        color: currentStyle.color,
        lineHeight: "1",
        display: "inline",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
};
