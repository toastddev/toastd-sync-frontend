import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import App from "./App";
import { ThemeContext, getInitialColorScheme, applyColorScheme, type ColorScheme } from "./theme";
import "./index.css";

// Vite's `import.meta.env.BASE_URL` is the build-time base (e.g. "/sync/" when
// embedded inside admin, "/" when standalone). Trim the trailing slash so
// react-router's `basename` is the canonical "/sync" or "".
const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function Root() {
  const [scheme, setScheme] = useState<ColorScheme>(getInitialColorScheme);

  useEffect(() => {
    applyColorScheme(scheme);
    localStorage.setItem("tvs_color_scheme", scheme);
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ scheme, setScheme }}>
      <AppProvider i18n={enTranslations}>
        <BrowserRouter basename={baseUrl || "/"}>
          <App />
        </BrowserRouter>
      </AppProvider>
    </ThemeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
