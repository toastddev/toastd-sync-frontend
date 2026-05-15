import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { auth } from "./api";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import SyncProcess from "./pages/SyncProcess";
import Vendors from "./pages/Vendors";
import VendorProducts from "./pages/VendorProducts";
import Settings from "./pages/Settings";
import EventLog from "./pages/EventLog";

function RequireAuth({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  if (!auth.isAuthed) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}

// Self-heal a `/sync/sync/...` URL produced by the parent admin's reverse
// proxy double-prefixing the SPA basename. Collapses repeated leading basename
// segments via history.replaceState so deep-links from outside still work.
function useDedupBasename() {
  useEffect(() => {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    if (!base || base === "/") return;
    const dup = `${base}${base}`;
    const { pathname, search, hash } = window.location;
    if (pathname === dup || pathname.startsWith(`${dup}/`)) {
      const fixed = pathname.replace(new RegExp(`^${dup.replace(/\//g, "\\/")}`), base);
      window.history.replaceState(null, "", `${fixed}${search}${hash}`);
    }
  }, []);
}

export default function App() {
  useDedupBasename();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<SyncProcess />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/:id" element={<VendorProducts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="logs" element={<EventLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
