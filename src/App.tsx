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

export default function App() {
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
        <Route index element={<Navigate to="/sync" replace />} />
        <Route path="sync" element={<SyncProcess />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/:id" element={<VendorProducts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="logs" element={<EventLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
