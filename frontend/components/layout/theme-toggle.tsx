"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useThemeStore } from "@/lib/store/use-theme-store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="gap-1.5 border-cyan-300/50 bg-cyan-50/70 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-400/30 dark:bg-cyan-900/30 dark:text-cyan-100 dark:hover:bg-cyan-900/45"
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {isDark ? "Light" : "Dark"}
    </Button>
  );
}

