import { createContext, useContext } from "react";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "tvs_color_scheme";

export function getInitialColorScheme(): ColorScheme {
  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "light" || stored === "dark") return stored;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function applyColorScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  // Polaris 13 reads this attribute on <html> to switch token values.
  document.documentElement.setAttribute("data-color-scheme", scheme);
  document.documentElement.style.colorScheme = scheme;
}

export const ThemeContext = createContext<{
  scheme: ColorScheme;
  setScheme: (s: ColorScheme) => void;
}>({
  scheme: "light",
  setScheme: () => {},
});

export function useColorScheme() {
  return useContext(ThemeContext);
}
