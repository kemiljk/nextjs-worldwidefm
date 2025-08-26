import { cn } from "@/lib/utils";

interface GenreTagProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "white" | "transparent";
}

export const GenreTag: React.FC<GenreTagProps> = ({ children, className = "", variant = "default" }) => {
  const baseClasses = "border rounded-full px-3 py-1 text-[12px] font-mono uppercase";

  const variantClasses = {
    default: "border-almostblack dark:border-white text-almostblack dark:text-white",
    white: "border-white text-white",
    transparent: "border-almostblack dark:border-white text-almostblack dark:text-white bg-transparent",
  };

  return <span className={cn(baseClasses, variantClasses[variant], className)}>{children}</span>;
};
