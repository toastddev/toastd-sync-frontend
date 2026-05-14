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
  // Polaris 13 dark mode is class-gated, not attribute-gated. The stylesheet
  // defines `.p-theme-light` (default :root) and `.p-theme-dark-experimental`
  // selectors holding the actual CSS custom properties — swap them on <html>.
  const root = document.documentElement;
  const body = document.body;
  if (scheme === "dark") {
    root.classList.add("p-theme-dark-experimental");
    root.classList.remove("p-theme-light");
    body?.classList.add("p-theme-dark-experimental");
    body?.classList.remove("p-theme-light");
  } else {
    root.classList.add("p-theme-light");
    root.classList.remove("p-theme-dark-experimental");
    body?.classList.add("p-theme-light");
    body?.classList.remove("p-theme-dark-experimental");
  }
  // Mirror to color-scheme so native form controls / scrollbars follow suit.
  root.style.colorScheme = scheme;
  // Kept for our own CSS bridge if anyone wants to target it.
  root.setAttribute("data-color-scheme", scheme);
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
