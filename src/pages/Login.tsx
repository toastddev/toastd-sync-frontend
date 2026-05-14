import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { MoonIcon, SunIcon } from "@shopify/polaris-icons";
import { api, auth } from "../api";
import { useColorScheme } from "../theme";

export default function Login() {
  const nav = useNavigate();
  const { scheme, setScheme } = useColorScheme();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.login(pw);
      auth.token = r.token;
      nav("/sync", { replace: true });
    } catch (e: any) {
      setErr(e.message || "login failed");
    } finally {
      setBusy(false);
    }
  }, [pw, nav]);

  return (
    <Page narrowWidth>
      <Box paddingBlockStart="800">
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h1" variant="heading2xl">
              Toastd Vendor Sync
            </Text>
            <Button
              variant="tertiary"
              icon={scheme === "dark" ? SunIcon : MoonIcon}
              accessibilityLabel="Toggle dark mode"
              onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
            />
          </InlineStack>

          <Card>
            <BlockStack gap="400">
              <Text as="p" tone="subdued">
                Enter the dashboard password to continue.
              </Text>
              {err && (
                <Banner tone="critical" title="Login failed">
                  <p>{err}</p>
                </Banner>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && pw) submit();
                }}
              >
                <FormLayout>
                  <TextField
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={pw}
                    onChange={setPw}
                    autoFocus
                  />
                  <Button
                    submit
                    variant="primary"
                    loading={busy}
                    disabled={!pw}
                    fullWidth
                  >
                    Log in
                  </Button>
                </FormLayout>
              </form>
            </BlockStack>
          </Card>
        </BlockStack>
      </Box>
    </Page>
  );
}
