import Link from "next/link";
import { MoodObject } from "@/lib/cosmic-config";
import { cn } from "@/lib/utils";

// Color map with approximate RGB values for our tailwind colors
const colorMap: { [key: string]: { r: number; g: number; b: number } } = {
  // Sky colors
  "sky-700": { r: 57, g: 73, b: 84 },
  "sky-500": { r: 94, g: 120, b: 138 },

  // Tan colors
  "tan-100": { r: 215, g: 208, b: 199 },
  "tan-400": { r: 158, g: 142, b: 120 },

  // Bronze colors
  "bronze-50": { r: 249, g: 234, b: 210 },
  "bronze-300": { r: 234, g: 178, b: 89 },

  // Crimson colors
  "crimson-400": { r: 195, g: 111, b: 83 },
  "crimson-600": { r: 138, g: 71, b: 49 },

  // Gray colors
  "gray-300": { r: 158, g: 165, b: 165 },
  "gray-700": { r: 68, g: 74, b: 74 },

  // Green colors
  "green-200": { r: 181, g: 192, b: 176 },
  "green-500": { r: 111, g: 130, b: 103 },
};

// Define gradient configurations
const gradientConfigs = [
  { from: "sky-700", to: "sky-500" },
  { from: "tan-100", to: "tan-400" },
  { from: "bronze-50", to: "bronze-300" },
  { from: "crimson-400", to: "crimson-600" },
  { from: "gray-300", to: "gray-700" },
  { from: "green-200", to: "green-500" },
];

// Calculate luminance of a color using WCAG formula
function getLuminance(color: { r: number; g: number; b: number }): number {
  // Normalize RGB values to 0-1
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  // Calculate luminance using WCAG formula
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Determine text color based on background luminance
function getTextColor(fromColor: string, toColor: string): string {
  // Get color values
  const fromRGB = colorMap[fromColor];
  const toRGB = colorMap[toColor];

  if (!fromRGB || !toRGB) {
    console.warn(`Color not found in map: ${fromColor} or ${toColor}`);
    return "text-gray-800"; // Safe fallback
  }

  // Calculate average luminance (simplified approximation of gradient)
  const avgLuminance = (getLuminance(fromRGB) + getLuminance(toRGB)) / 2;

  // Use WCAG recommended contrast threshold
  return avgLuminance > 0.5 ? "text-gray-800" : "text-white";
}

// Generate gradient configuration for a mood
function getGradientConfig(mood: MoodObject): { gradient: string; textColor: string } {
  // Use the first character of the mood slug as a simple hash
  const index = mood.slug.charCodeAt(0) % gradientConfigs.length;
  const config = gradientConfigs[index];

  return {
    gradient: `from-${config.from} to-${config.to}`,
    textColor: getTextColor(config.from, config.to),
  };
}

// Alternative gradient patterns - can be used for more variety
function getPatternClass(mood: MoodObject): string {
  const patterns = ["bg-gradient-to-r", "bg-gradient-to-br", "bg-gradient-to-tr"];

  // Use the second character as a hash for pattern direction
  const patternIndex = (mood.slug.length > 1 ? mood.slug.charCodeAt(1) : 0) % patterns.length;
  return patterns[patternIndex];
}

interface MoodCardProps {
  mood: MoodObject;
  className?: string;
}

export default function MoodCard({ mood, className }: MoodCardProps) {
  const { gradient, textColor } = getGradientConfig(mood);
  const patternClass = getPatternClass(mood);

  return (
    <Link href={`/moods/${mood.slug}`} className={cn("flex-shrink-0 transition-all duration-300", "px-6 py-4 rounded-lg font-medium min-w-[160px]", "flex items-center justify-center text-lg shadow-md", "hover:shadow-lg hover:scale-105", patternClass, gradient, textColor, className)}>
      <span className={cn("drop-shadow-sm", textColor === "text-white" ? "drop-shadow-md" : "")}>{mood.title}</span>
    </Link>
  );
}
