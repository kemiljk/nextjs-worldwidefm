import { cn } from "@/lib/utils";

interface GenreTagProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "white" | "transparent";
}

export const GenreTag: React.FC<GenreTagProps> = ({ children, className = "", variant = "default" }) => {
  const baseClasses = "border-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase";

  const variantClasses = {
    default: "border-almostblack dark:border-white text-almostblack dark:text-white",
    white: "border-white text-white",
    transparent: "border-almostblack dark:border-white text-almostblack dark:text-white bg-transparent",
  };

  return <span className={cn(baseClasses, variantClasses[variant], className)}>{children}</span>;
};
