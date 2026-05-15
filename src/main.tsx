import React, { forwardRef, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link as RRLink } from "react-router-dom";
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

// Polaris's `linkComponent` makes every Polaris-rendered link (Navigation
// items, Buttons with `url`, Page primary actions, etc.) flow through React
// Router's pushState instead of the browser's full-page navigation. Without
// this, clicking the Vendors/Settings tabs would do a real navigation to
// /sync/vendors which the parent admin's reverse proxy bounces to the admin
// home (it doesn't have an SPA fallback for /sync/*).
const PolarisLink = forwardRef<HTMLAnchorElement, any>(function PolarisLink(
  { url, children, external, ...rest },
  ref,
) {
  // External or absolute http(s) links bypass React Router — they really do
  // need a full navigation (and `target=_blank` semantics).
  const isExternal = external || (typeof url === "string" && /^https?:\/\//i.test(url));
  if (isExternal) {
    return (
      <a
        href={url}
        ref={ref}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  }
  // React Router's <Link> renders a real <a href> (so middle-click / right-
  // click "copy link" still work and include the basename) but intercepts
  // left-clicks and uses pushState — never escapes the embed.
  return (
    <RRLink to={url ?? "#"} ref={ref} {...rest}>
      {children}
    </RRLink>
  );
});

function Root() {
  const [scheme, setScheme] = useState<ColorScheme>(getInitialColorScheme);

  useEffect(() => {
    applyColorScheme(scheme);
    localStorage.setItem("tvs_color_scheme", scheme);
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ scheme, setScheme }}>
      {/* BrowserRouter must wrap AppProvider so PolarisLink (which uses
          React Router's Link) is inside the router context. */}
      <BrowserRouter basename={baseUrl || "/"}>
        <AppProvider i18n={enTranslations} linkComponent={PolarisLink}>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
