import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type FontSize = "sm" | "md" | "lg" | "xl";
type ThemeMode = "light" | "dark";

const SIZE_CLASSES: Record<FontSize, string> = {
  sm: "text-size-sm",
  md: "text-size-md",
  lg: "text-size-lg",
  xl: "text-size-xl",
};

const SIZE_ORDER: FontSize[] = ["sm", "md", "lg", "xl"];

function loadSize(): FontSize {
  try {
    const stored = localStorage.getItem("bhoomi_font_size");
    if (stored && SIZE_ORDER.includes(stored as FontSize)) return stored as FontSize;
  } catch {
    /* ignore */
  }
  return "md";
}

function applySize(size: FontSize) {
  const html = document.documentElement;
  SIZE_ORDER.forEach((s) => html.classList.remove(SIZE_CLASSES[s]));
  if (size !== "md") html.classList.add(SIZE_CLASSES[size]);
}

function loadContrast(): boolean {
  try { return localStorage.getItem("bhoomi_high_contrast") === "1"; } catch { return false; }
}

function applyContrast(on: boolean) {
  if (on) document.documentElement.classList.add("high-contrast");
  else    document.documentElement.classList.remove("high-contrast");
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem("bhoomi_theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme: ThemeMode) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

export function AccessibilityBar({ compact = false }: { compact?: boolean }) {
  const [size, setSize]         = useState<FontSize>(loadSize);
  const [contrast, setContrast] = useState<boolean>(loadContrast);
  const [theme, setTheme]       = useState<ThemeMode>(loadTheme);

  useEffect(() => { applySize(size); try { localStorage.setItem("bhoomi_font_size", size); } catch { /* ignore */ } }, [size]);
  useEffect(() => { applyContrast(contrast); try { localStorage.setItem("bhoomi_high_contrast", contrast ? "1" : "0"); } catch { /* ignore */ } }, [contrast]);
  useEffect(() => { applyTheme(theme); try { localStorage.setItem("bhoomi_theme", theme); } catch { /* ignore */ } }, [theme]);

  const decrease = () => {
    const idx = SIZE_ORDER.indexOf(size);
    if (idx > 0) setSize(SIZE_ORDER[idx - 1]);
  };
  const increase = () => {
    const idx = SIZE_ORDER.indexOf(size);
    if (idx < SIZE_ORDER.length - 1) setSize(SIZE_ORDER[idx + 1]);
  };
  const reset = () => setSize("md");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const btnBase = compact
    ? "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
    : "inline-flex items-center justify-center rounded px-2 py-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors";

  return (
    <div
      className="inline-flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Accessibility and display settings"
    >
      <button onClick={decrease} className={btnBase} aria-label="Decrease text size" title="Decrease text size">
        A<sup style={{ fontSize: "0.65em", lineHeight: 1 }}>−</sup>
      </button>
      <button onClick={reset} className={btnBase} aria-label="Reset text size" title="Reset text size">
        A
      </button>
      <button onClick={increase} className={btnBase} aria-label="Increase text size" title="Increase text size">
        A<sup style={{ fontSize: "0.65em", lineHeight: 1 }}>+</sup>
      </button>

      <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-[var(--border)]" />

      <button
        onClick={() => setContrast((c) => !c)}
        className={`${btnBase} ${contrast ? "text-[var(--accent-saffron)] font-black" : ""}`}
        aria-label={contrast ? "Disable high contrast" : "Enable high contrast"}
        aria-pressed={contrast}
        title="Toggle high contrast"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 1.5v13" />
          <path d="M8 8a6.5 6.5 0 0 1 0-6.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-[var(--border)]" />

      <button
        onClick={toggleTheme}
        className={btnBase}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={theme === "dark"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <Sun className="h-3.5 w-3.5 text-[var(--accent-saffron)]" aria-hidden="true" />
        ) : (
          <Moon className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
