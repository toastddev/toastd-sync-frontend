import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  Banner,
  Frame,
  Navigation,
  TopBar,
} from "@shopify/polaris";
import {
  HomeIcon,
  PersonIcon,
  ClipboardCheckFilledIcon,
  SettingsIcon,
  ExitIcon,
  SunIcon,
  MoonIcon,
  RefreshIcon,
} from "@shopify/polaris-icons";
import { api, auth } from "../api";
import { useColorScheme } from "../theme";

const navItems = [
  { url: "/sync", label: "Sync Process", icon: HomeIcon },
  { url: "/vendors", label: "Vendors", icon: PersonIcon },
  { url: "/logs", label: "Event Log", icon: ClipboardCheckFilledIcon },
  { url: "/settings", label: "Settings", icon: SettingsIcon },
];

interface AuthIssues {
  shipturtle?: string;
  shopify?: string;
  toastd?: string;
}

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { scheme, setScheme } = useColorScheme();
  const [mobileNavActive, setMobileNavActive] = useState(false);
  const [userMenuActive, setUserMenuActive] = useState(false);
  const [authIssues, setAuthIssues] = useState<AuthIssues>({});

  const toggleMobileNav = useCallback(() => setMobileNavActive((v) => !v), []);
  const toggleUserMenu = useCallback(() => setUserMenuActive((v) => !v), []);
  const toggleScheme = useCallback(
    () => setScheme(scheme === "dark" ? "light" : "dark"),
    [scheme, setScheme],
  );

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const s = await api.authStatus();
        if (!alive) return;
        const issues: AuthIssues = {};
        if (!s.shipturtle?.ok) issues.shipturtle = s.shipturtle?.error ?? "invalid";
        if (!s.shopify?.ok) issues.shopify = s.shopify?.error ?? "invalid";
        if (!s.toastd?.ok) issues.toastd = s.toastd?.error ?? "invalid";
        setAuthIssues(issues);
      } catch {}
    };
    check();
    const i = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  const issueLines = useMemo(() => {
    const out: string[] = [];
    if (authIssues.shipturtle) out.push(`ShipTurtle: ${authIssues.shipturtle}`);
    if (authIssues.shopify) out.push(`Shopify: ${authIssues.shopify}`);
    if (authIssues.toastd) out.push(`Toastd: ${authIssues.toastd}`);
    return out;
  }, [authIssues]);

  const navigation = (
    <Navigation location={loc.pathname}>
      <Navigation.Section
        items={navItems.map((n) => ({
          url: n.url,
          label: n.label,
          icon: n.icon,
          selected: loc.pathname === n.url || loc.pathname.startsWith(n.url + "/"),
          onClick: (e?: any) => {
            // Polaris fires this for keyboard too; intercept and use react-router
            if (e?.preventDefault) e.preventDefault();
            nav(n.url);
            setMobileNavActive(false);
          },
        }))}
      />
    </Navigation>
  );

  const userMenu = (
    <TopBar.UserMenu
      actions={[
        {
          items: [
            {
              content: scheme === "dark" ? "Switch to light" : "Switch to dark",
              icon: scheme === "dark" ? SunIcon : MoonIcon,
              onAction: toggleScheme,
            },
          ],
        },
        {
          items: [
            {
              content: "Refresh dashboard",
              icon: RefreshIcon,
              onAction: () => window.location.reload(),
            },
            {
              content: "Log out",
              icon: ExitIcon,
              onAction: () => auth.logout(),
            },
          ],
        },
      ]}
      name="Toastd"
      detail="Vendor Sync"
      initials="TD"
      open={userMenuActive}
      onToggle={toggleUserMenu}
    />
  );

  const topBar = (
    <TopBar
      showNavigationToggle
      userMenu={userMenu}
      onNavigationToggle={toggleMobileNav}
    />
  );

  return (
    <Frame
      topBar={topBar}
      navigation={navigation}
      showMobileNavigation={mobileNavActive}
      onNavigationDismiss={toggleMobileNav}
      logo={{
        width: 124,
        // Logo text colour follows the active scheme so it stays legible on the
        // TopBar in both light and dark mode.
        topBarSource:
          scheme === "dark"
            ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 32'><text x='0' y='22' font-family='Inter,Segoe UI,sans-serif' font-size='18' font-weight='700' fill='%23e3e3e3'>Toastd Sync</text></svg>"
            : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 32'><text x='0' y='22' font-family='Inter,Segoe UI,sans-serif' font-size='18' font-weight='700' fill='%23202223'>Toastd Sync</text></svg>",
        contextualSaveBarSource:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 32'><text x='0' y='22' font-family='Inter,Segoe UI,sans-serif' font-size='18' font-weight='700' fill='%23fff'>Toastd Sync</text></svg>",
        url: "/",
        accessibilityLabel: "Toastd Sync",
      }}
    >
      {issueLines.length > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <Banner
            tone="warning"
            title="Some services need attention"
            action={{ content: "Open Settings", onAction: () => nav("/settings") }}
          >
            <p>{issueLines.join(" · ")}</p>
          </Banner>
        </div>
      )}
      <Outlet />
    </Frame>
  );
}
