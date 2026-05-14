import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Collapsible,
  Divider,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { api } from "../api";

type Tone = "success" | "info" | "warning" | "critical" | undefined;

function StatusBadge({ ok, label, error }: { ok?: boolean; label: string; error?: string }) {
  if (ok) return <Badge tone="success">{label}</Badge>;
  return <Badge tone="critical">{error ?? "invalid"}</Badge>;
}

export default function Settings() {
  const [s, setS] = useState<any>(null);
  const [authStat, setAuthStat] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  // ── core credential drafts (only sent when non-blank, to avoid clobber) ──
  const [shipturtleToken, setShipTok] = useState("");
  const [shopifyDomain, setShopDomain] = useState("");
  const [shopifyToken, setShopTok] = useState("");
  const [toastdToken, setToastdTok] = useState("");
  const [hint, setHint] = useState("");
  const [interval, setIntervalMin] = useState<string>("30");

  // ── auto-refresh fields ──
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [stUsername, setStUsername] = useState("");
  const [stPassword, setStPassword] = useState("");
  const [stClientId, setStClientId] = useState("");
  const [stClientSecret, setStClientSecret] = useState("");
  const [stRefreshToken, setStRefreshToken] = useState("");

  const load = useCallback(async () => {
    const cur = await api.getSettings();
    setS(cur);
    setShopDomain(cur.shopifyStoreDomain || "");
    setHint(cur.toastdPublicationNameHint || "");
    setIntervalMin(String(cur.syncIntervalMinutes || 30));
    setAutoRefreshEnabled(!!cur.shipturtleAutoRefreshEnabled);
    setStUsername(cur.shipturtleUsername || "");
    setStClientId(cur.shipturtleClientId || "");
    // never seed secrets back into editable fields — let the placeholder show "leave blank to keep"
    setStPassword("");
    setStClientSecret("");
    setStRefreshToken("");
  }, []);

  useEffect(() => {
    load();
    api.authStatus().then(setAuthStat).catch(() => {});
  }, [load]);

  const save = useCallback(async () => {
    setBusy("save");
    setMsg(null);
    try {
      const body: any = {
        shopifyStoreDomain: shopifyDomain,
        toastdPublicationNameHint: hint,
        syncIntervalMinutes: Number(interval) || 30,
        shipturtleAutoRefreshEnabled: autoRefreshEnabled,
      };
      if (shipturtleToken) body.shipturtleToken = shipturtleToken;
      if (shopifyToken) body.shopifyAdminToken = shopifyToken;
      if (toastdToken) body.toastdAdminToken = toastdToken;
      // Auto-refresh credentials — only sent when the user has typed a new value.
      if (stUsername) body.shipturtleUsername = stUsername;
      if (stPassword) body.shipturtlePassword = stPassword;
      if (stClientId) body.shipturtleClientId = stClientId;
      if (stClientSecret) body.shipturtleClientSecret = stClientSecret;
      if (stRefreshToken) body.shipturtleRefreshToken = stRefreshToken;

      await api.putSettings(body);
      setShipTok("");
      setShopTok("");
      setToastdTok("");
      setStPassword("");
      setStClientSecret("");
      setStRefreshToken("");
      setMsg({ tone: "success", text: "Settings saved." });
      load();
    } catch (e: any) {
      setMsg({ tone: "critical", text: e.message });
    } finally {
      setBusy(null);
    }
  }, [
    shopifyDomain,
    hint,
    interval,
    autoRefreshEnabled,
    shipturtleToken,
    shopifyToken,
    toastdToken,
    stUsername,
    stPassword,
    stClientId,
    stClientSecret,
    stRefreshToken,
    load,
  ]);

  const validate = useCallback(async () => {
    setBusy("validate");
    try {
      const r = await api.authStatus();
      setAuthStat(r);
    } finally {
      setBusy(null);
    }
  }, []);

  const refreshNow = useCallback(async () => {
    setBusy("refresh");
    setMsg(null);
    try {
      const r = await api.refreshShipturtleToken();
      if (r.ok) {
        setMsg({
          tone: "success",
          text: `ShipTurtle token refreshed (expires in ${Math.round((r.expiresIn ?? 0) / 86400)} days, …${r.tokenTail}).`,
        });
        await load();
        await validate();
      } else {
        setMsg({ tone: "critical", text: r.error ?? "Refresh failed" });
      }
    } catch (e: any) {
      setMsg({ tone: "critical", text: e.message });
    } finally {
      setBusy(null);
    }
  }, [load, validate]);

  if (!s) {
    return (
      <Page title="Settings">
        <Box padding="800">
          <InlineStack gap="200" align="center">
            <Spinner size="small" />
            <Text as="span" tone="subdued">
              Loading…
            </Text>
          </InlineStack>
        </Box>
      </Page>
    );
  }

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: save,
        loading: busy === "save",
        disabled: busy === "save",
      }}
      secondaryActions={[
        {
          content: "Validate",
          onAction: validate,
          loading: busy === "validate",
        },
      ]}
    >
      <BlockStack gap="400">
        {msg && (
          <Banner tone={msg.tone} onDismiss={() => setMsg(null)}>
            <p>{msg.text}</p>
          </Banner>
        )}

        <Layout>
          {/* ── ShipTurtle ── */}
          <Layout.AnnotatedSection
            id="shipturtle"
            title="ShipTurtle"
            description="Bearer token used for vendor and product lookups. Optionally enable auto-refresh so an expired token never interrupts a sync."
          >
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" tone="subdued">
                    Current:
                  </Text>
                  {s._hasShipturtleToken ? (
                    <Badge tone="success">{`set (${s.shipturtleToken})`}</Badge>
                  ) : (
                    <Badge tone="critical">missing</Badge>
                  )}
                </InlineStack>

                <TextField
                  label="Bearer token"
                  type="password"
                  autoComplete="off"
                  value={shipturtleToken}
                  onChange={setShipTok}
                  placeholder={s._hasShipturtleToken ? "leave blank to keep existing" : "paste Bearer token"}
                />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">
                    Status:
                  </Text>
                  <StatusBadge
                    ok={!!authStat?.shipturtle?.ok}
                    label={`OK (${authStat?.shipturtle?.vendorCount ?? 0} vendors)`}
                    error={authStat?.shipturtle?.error}
                  />
                </InlineStack>

                <Divider />

                {/* Auto-refresh sub-section */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">
                      Auto-refresh expired token
                    </Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      When a sync hits an auth error, the dashboard automatically re-mints the bearer using these credentials and resumes.
                    </Text>
                  </BlockStack>
                  <Button
                    pressed={autoRefreshEnabled}
                    onClick={() => setAutoRefreshEnabled((v) => !v)}
                    variant={autoRefreshEnabled ? "primary" : "secondary"}
                  >
                    {autoRefreshEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </InlineStack>

                <Collapsible
                  id="refresh-fields"
                  open={autoRefreshEnabled}
                  transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
                >
                  <BlockStack gap="300">
                    <Banner tone="info">
                      <p>
                        These 4 fields are the OAuth password-grant payload from{" "}
                        <code>POST /oauth/token</code>. The refresh_token is optional — when missing or expired,
                        we fall back to username + password.
                      </p>
                    </Banner>

                    <FormLayout>
                      <FormLayout.Group>
                        <TextField
                          label="username"
                          autoComplete="username"
                          value={stUsername}
                          onChange={setStUsername}
                          placeholder="e.g. vansh_toastd"
                        />
                        <TextField
                          label="password"
                          type="password"
                          autoComplete="new-password"
                          value={stPassword}
                          onChange={setStPassword}
                          placeholder={s._hasShipturtlePassword ? "leave blank to keep existing" : "account password"}
                        />
                      </FormLayout.Group>
                      <FormLayout.Group>
                        <TextField
                          label="client_id"
                          autoComplete="off"
                          value={stClientId}
                          onChange={setStClientId}
                          placeholder="e.g. 2"
                        />
                        <TextField
                          label="client_secret"
                          type="password"
                          autoComplete="off"
                          value={stClientSecret}
                          onChange={setStClientSecret}
                          placeholder={s._hasShipturtleClientSecret ? "leave blank to keep existing" : "ShipTurtle client secret"}
                        />
                      </FormLayout.Group>
                      <TextField
                        label="refresh_token (optional)"
                        type="password"
                        autoComplete="off"
                        helpText="Last refresh_token returned by ShipTurtle. Filled automatically on every successful refresh."
                        value={stRefreshToken}
                        onChange={setStRefreshToken}
                        placeholder={
                          s._hasShipturtleRefreshToken
                            ? `stored (${s.shipturtleRefreshToken}) — leave blank to keep`
                            : "blank — password grant will be used"
                        }
                      />
                    </FormLayout>

                    <InlineStack gap="200" align="start">
                      <Button onClick={refreshNow} loading={busy === "refresh"} disabled={busy === "refresh"}>
                        Refresh token now
                      </Button>
                      {s.shipturtleTokenRefreshedAt && (
                        <Text as="span" tone="subdued" variant="bodySm">
                          Last refreshed {new Date(s.shipturtleTokenRefreshedAt).toLocaleString()}
                          {s.shipturtleTokenExpiresAt
                            ? ` · expires ${new Date(s.shipturtleTokenExpiresAt).toLocaleString()}`
                            : ""}
                        </Text>
                      )}
                    </InlineStack>
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* ── Shopify ── */}
          <Layout.AnnotatedSection
            id="shopify"
            title="Toastd Shopify (merchant store)"
            description="Admin API token + store domain used to resolve product GIDs, set inventory, and publish to Toastd's publication."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="myshopify domain"
                  autoComplete="off"
                  value={shopifyDomain}
                  onChange={setShopDomain}
                  placeholder="e.g. toastd.myshopify.com"
                />
                <TextField
                  label="Admin API token"
                  type="password"
                  autoComplete="off"
                  value={shopifyToken}
                  onChange={setShopTok}
                  placeholder={
                    s._hasShopifyAdminToken ? "leave blank to keep existing admin token" : "Admin API access token"
                  }
                />
                <TextField
                  label="Toastd publication name (optional)"
                  autoComplete="off"
                  value={hint}
                  onChange={setHint}
                  placeholder="e.g. 'Toastd Inventory' — blank to auto-detect"
                />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">
                    Status:
                  </Text>
                  <StatusBadge
                    ok={!!authStat?.shopify?.ok}
                    label={`OK (${authStat?.shopify?.shop?.name ?? ""})`}
                    error={authStat?.shopify?.error}
                  />
                </InlineStack>
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          {/* ── Toastd ── */}
          <Layout.AnnotatedSection
            id="toastd"
            title="Toastd backend (api.toastd.in)"
            description="Sent as x-toastd-access-token on every Toastd API call (brands, AI product create, file uploads)."
          >
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" tone="subdued">
                    Current:
                  </Text>
                  {s._hasToastdAdminToken ? (
                    <Badge tone="success">{`set (${s.toastdAdminToken})`}</Badge>
                  ) : (
                    <Badge tone="critical">missing</Badge>
                  )}
                </InlineStack>
                <TextField
                  label="Toastd admin token"
                  type="password"
                  autoComplete="off"
                  value={toastdToken}
                  onChange={setToastdTok}
                  placeholder={s._hasToastdAdminToken ? "leave blank to keep existing" : "paste Toastd admin token"}
                />
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" tone="subdued" variant="bodySm">
                    Status:
                  </Text>
                  <StatusBadge
                    ok={!!authStat?.toastd?.ok}
                    label={`OK (${authStat?.toastd?.brandCount ?? 0} brands)`}
                    error={authStat?.toastd?.error}
                  />
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>

          {/* ── Cron ── */}
          <Layout.AnnotatedSection
            id="cron"
            title="Cron"
            description="Controls the background sync cadence. Changing the interval requires a backend restart to take effect (SYNC_CRON env var)."
          >
            <Card>
              <TextField
                label="Sync interval (minutes)"
                type="number"
                min={5}
                max={1440}
                autoComplete="off"
                value={interval}
                onChange={setIntervalMin}
              />
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
