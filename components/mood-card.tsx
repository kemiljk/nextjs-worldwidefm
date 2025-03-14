import Link from "next/link";
import { MoodObject } from "@/lib/cosmic-config";
import { cn } from "@/lib/utils";

// Color map with RGB values from tailwind.config.ts
const colorMap: { [key: string]: { r: number; g: number; b: number } } = {
  // Sky colors
  "sky-300": { r: 144, g: 165, b: 179 }, // #90a5b3
  "sky-400": { r: 117, g: 143, b: 161 }, // #758fa1
  "sky-500": { r: 94, g: 120, b: 138 }, // #5e788a
  "sky-600": { r: 76, g: 97, b: 111 }, // #4c616f
  "sky-700": { r: 57, g: 73, b: 84 }, // #394954

  // Tan colors
  "tan-300": { r: 177, g: 164, b: 146 }, // #b1a492
  "tan-400": { r: 158, g: 142, b: 120 }, // #9e8e78
  "tan-500": { r: 135, g: 119, b: 97 }, // #877761
  "tan-600": { r: 109, g: 96, b: 78 }, // #6d604e
  "tan-700": { r: 82, g: 71, b: 59 }, // #52473b

  // Bronze colors
  "bronze-300": { r: 234, g: 178, b: 89 }, // #eab259
  "bronze-400": { r: 229, g: 159, b: 48 }, // #e59f30
  "bronze-500": { r: 207, g: 136, b: 26 }, // #cf881a
  "bronze-600": { r: 166, g: 110, b: 21 }, // #a66e15
  "bronze-700": { r: 126, g: 83, b: 16 }, // #7e5310

  // Crimson colors
  "crimson-300": { r: 206, g: 139, b: 117 }, // #ce8b75
  "crimson-400": { r: 195, g: 111, b: 83 }, // #c36f53
  "crimson-500": { r: 172, g: 88, b: 60 }, // #ac583c
  "crimson-600": { r: 138, g: 71, b: 49 }, // #8a4731
  "crimson-700": { r: 105, g: 54, b: 37 }, // #693625

  // Gray colors
  "gray-300": { r: 158, g: 165, b: 165 }, // #9ea5a5
  "gray-400": { r: 134, g: 144, b: 160 }, // #8690a0
  "gray-500": { r: 111, g: 121, b: 121 }, // #6f7979
  "gray-600": { r: 90, g: 97, b: 97 }, // #5a6161
  "gray-700": { r: 68, g: 74, b: 74 }, // #444a4a
  "gray-800": { r: 46, g: 50, b: 50 }, // #2e3232

  // Green colors
  "green-300": { r: 157, g: 172, b: 151 }, // #9dac97
  "green-400": { r: 134, g: 152, b: 125 }, // #86987d
  "green-500": { r: 111, g: 130, b: 103 }, // #6f8267
  "green-600": { r: 88, g: 104, b: 83 }, // #586853
  "green-700": { r: 65, g: 80, b: 63 }, // #41503f

  // White (for text)
  white: { r: 255, g: 255, b: 255 }, // #FFFFFF
};

// All available color families
const colorFamilies = ["sky", "tan", "bronze", "crimson", "gray", "green"];

// Available shade levels
const shades = [300, 400, 500, 600, 700];

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

// Generate a deterministic but varied hash value from a string
function getHashValue(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % max;
}

// Intelligently generate a gradient for a mood
function generateGradientForMood(mood: MoodObject): { fromColor: string; toColor: string } {
  // Use the mood's slug to deterministically select colors that will remain consistent for the same mood

  // Select first color family (use first part of the slug)
  const firstFamilyIndex = getHashValue(mood.slug, colorFamilies.length);
  const firstFamily = colorFamilies[firstFamilyIndex];

  // Select second color family (use second part of the slug + title to ensure variety)
  const secondHashSource = mood.slug + mood.title;
  const secondFamilyIndex = getHashValue(secondHashSource, colorFamilies.length);
  // Ensure we don't get the same family twice by shifting if needed
  const secondFamily = colorFamilies[(secondFamilyIndex + (firstFamilyIndex === secondFamilyIndex ? 1 : 0)) % colorFamilies.length];

  // Select shades (vary from lighter to darker for better gradient effect)
  const fromShadeIndex = getHashValue(mood.slug + "from", shades.length);
  const toShadeIndex = getHashValue(mood.slug + "to", shades.length);

  // Get the actual shade values
  const fromShade = shades[fromShadeIndex];
  const toShade = shades[toShadeIndex];

  // Return the full color identifiers
  return {
    fromColor: `${firstFamily}-${fromShade}`,
    toColor: `${secondFamily}-${toShade}`,
  };
}

// Get card configuration for a mood
function getCardConfig(mood: MoodObject): { bgClass: string; textColor: string } {
  // Generate a gradient specifically for this mood
  const { fromColor, toColor } = generateGradientForMood(mood);

  // Verify that both colors exist in our colorMap
  const fromExists = colorMap[fromColor] !== undefined;
  const toExists = colorMap[toColor] !== undefined;

  if (!fromExists || !toExists) {
    console.warn(`Generated invalid color: ${!fromExists ? fromColor : toColor} for mood: ${mood.slug}`);
    // Fallback to a safe gradient
    return {
      bgClass: "bg-gradient-to-r from-gray-400 to-gray-600 bg-opacity-100",
      textColor: "text-white",
    };
  }

  // Create the gradient class with a fallback background color to prevent transparency
  const bgClass = `bg-gradient-to-r from-${fromColor} to-${toColor} bg-opacity-100`;

  return {
    bgClass,
    textColor: getTextColor(fromColor, toColor),
  };
}

// Create alternative pattern for a mood (direction variation)
function getPatternVariation(mood: MoodObject, baseClass: string): string {
  const directions = ["bg-gradient-to-r", "bg-gradient-to-br", "bg-gradient-to-tr"];

  // Use the second character as a hash for pattern direction
  const dirIndex = getHashValue(mood.slug + "direction", directions.length);
  const direction = directions[dirIndex];

  // Replace the direction in the base class
  return baseClass.replace(/bg-gradient-to-\w+/, direction);
}

interface MoodCardProps {
  mood: MoodObject;
  className?: string;
}

export default function MoodCard({ mood, className }: MoodCardProps) {
  const { bgClass, textColor } = getCardConfig(mood);
  const finalBgClass = getPatternVariation(mood, bgClass);

  return (
    <Link
      href={`/moods/${mood.slug}`}
      className={cn(
        // Base styles
        "flex-shrink-0 transition-all duration-300",
        "px-6 py-4 rounded-lg font-medium min-w-[160px]",
        "flex items-center justify-center text-lg shadow-md",

        // Background gradient - must come before other classes that might override it
        finalBgClass,
        // Fallback background to prevent transparency
        "bg-gray-500",

        // Additional styles
        "hover:shadow-2xl hover:scale-105",
        textColor,
        className
      )}
    >
      {mood.title}
    </Link>
  );
}
