import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import App from "./App";
import { ThemeContext, getInitialColorScheme, applyColorScheme, type ColorScheme } from "./theme";
import "./index.css";

function Root() {
  const [scheme, setScheme] = useState<ColorScheme>(getInitialColorScheme);

  useEffect(() => {
    applyColorScheme(scheme);
    localStorage.setItem("tvs_color_scheme", scheme);
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ scheme, setScheme }}>
      <AppProvider i18n={enTranslations}>
        <BrowserRouter>
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
