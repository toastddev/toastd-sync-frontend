import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Spinner,
  Text,
  Tooltip,
} from "@shopify/polaris";
import { api } from "../api";

type Tone = "success" | "info" | "warning" | "critical" | undefined;

function statusTone(s?: string | null): Tone {
  if (s === "done" || s === "ok") return "success";
  if (s === "running") return "info";
  if (s === "error") return "critical";
  return undefined;
}

export default function SyncProcess() {
  const [settings, setSettings] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [job, setJob] = useState<any>(null);
  const [regressions, setRegressions] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: Tone; msg: string } | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, v, st, r] = await Promise.all([
        api.getSettings(),
        api.listVendors(),
        api.syncStatus(),
        api.regressions().catch(() => []),
      ]);
      setSettings(s);
      setVendors(v);
      setJob(st.current);
      setRegressions(r);
    } catch (e: any) {
      setToast({ tone: "critical", msg: e.message });
    }
  }, []);

  useEffect(() => {
    loadAll();
    const i = setInterval(async () => {
      try {
        const st = await api.syncStatus();
        setJob(st.current);
      } catch {}
    }, 2000);
    return () => clearInterval(i);
  }, [loadAll]);

  const toggleGlobal = useCallback(
    async (v: boolean) => {
      await api.putSettings({ globalSyncEnabled: v });
      loadAll();
    },
    [loadAll],
  );

  const toggleVendor = useCallback(
    async (vendor: any, val: boolean) => {
      await api.patchVendor(vendor.id, { syncEnabled: val });
      loadAll();
    },
    [loadAll],
  );

  const runVendor = useCallback(
    async (v: any) => {
      if (!v.brandId) {
        setToast({ tone: "warning", msg: "Map this vendor to a Toastd brand on the Vendors tab first." });
        return;
      }
      setBusy(v.id);
      try {
        await api.syncVendor(v.id);
        loadAll();
      } catch (e: any) {
        setToast({ tone: "critical", msg: e.message });
      } finally {
        setBusy(null);
      }
    },
    [loadAll],
  );

  const runAll = useCallback(async () => {
    setBusy("all");
    try {
      await api.runAll();
      loadAll();
    } catch (e: any) {
      setToast({ tone: "critical", msg: e.message });
    } finally {
      setBusy(null);
    }
  }, [loadAll]);

  const runDriftCheck = useCallback(async () => {
    setBusy("drift");
    try {
      await api.runDriftCheck();
      loadAll();
    } catch (e: any) {
      setToast({ tone: "critical", msg: e.message });
    } finally {
      setBusy(null);
    }
  }, [loadAll]);

  const eligible = useMemo(
    () => vendors.filter((v) => v.vendorType === "Using vendor sync"),
    [vendors],
  );
  const enabled = eligible.filter((v) => v.syncEnabled);

  const progressPct = job?.total ? Math.round(((job.processed ?? 0) / job.total) * 100) : 0;

  if (!settings) {
    return (
      <Page title="Sync Process">
        <Box padding="800">
          <InlineStack align="center" blockAlign="center" gap="200">
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
      title="Sync Process"
      primaryAction={{
        content: busy === "all" ? "Running…" : "Run all enabled now",
        onAction: runAll,
        disabled: !settings.globalSyncEnabled || busy === "all" || enabled.length === 0,
        loading: busy === "all",
      }}
      secondaryActions={[
        {
          content: settings.globalSyncEnabled ? "Auto-sync ON" : "Auto-sync OFF",
          onAction: () => toggleGlobal(!settings.globalSyncEnabled),
        },
      ]}
    >
      {toast && (
        <Box paddingBlockEnd="400">
          <Banner tone={toast.tone} onDismiss={() => setToast(null)}>
            <p>{toast.msg}</p>
          </Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Current job */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Current job
                  </Text>
                  {job && (
                    <Badge tone={statusTone(job.status)}>
                      {`${job.status} · ${job.trigger}`}
                    </Badge>
                  )}
                </InlineStack>

                {!job ? (
                  <Text as="p" tone="subdued">
                    No job running.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    <Text as="p">
                      <Text as="span" tone="subdued">
                        Vendor:
                      </Text>{" "}
                      {job.currentVendorName ?? "—"}
                      {job.currentBrandName ? (
                        <Text as="span" tone="subdued"> · brand {job.currentBrandName}</Text>
                      ) : null}
                    </Text>
                    <Text as="p">
                      <Text as="span" tone="subdued">
                        Product:
                      </Text>{" "}
                      {job.currentProductTitle ?? "—"}
                    </Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" tone="subdued">
                        Progress:
                      </Text>
                      <Text as="span">
                        {job.processed ?? 0}/{job.total ?? 0}
                      </Text>
                      <Badge tone="success">{`OK ${job.succeeded ?? 0}`}</Badge>
                      <Badge tone="critical">{`Fail ${job.failed ?? 0}`}</Badge>
                    </InlineStack>
                    <ProgressBar progress={progressPct} size="small" />
                    {job.error && (
                      <Banner tone="critical" title="Job error">
                        <p>{job.error}</p>
                      </Banner>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Regressions */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Regressions ({regressions.length})
                  </Text>
                  <Button
                    onClick={runDriftCheck}
                    loading={busy === "drift"}
                    disabled={busy === "drift"}
                    size="slim"
                  >
                    Run drift check
                  </Button>
                </InlineStack>
                {regressions.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No regressions detected. Drift check runs hourly and flags products that went mapped/partial → unmapped.
                  </Text>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "regression", plural: "regressions" }}
                    itemCount={regressions.length}
                    headings={[
                      { title: "Product" },
                      { title: "Vendor" },
                      { title: "Was → Is" },
                      { title: "When" },
                    ]}
                    selectable={false}
                  >
                    {regressions.slice(0, 25).map((p, idx) => (
                      <IndexTable.Row id={p.id ?? String(idx)} key={p.id ?? idx} position={idx}>
                        <IndexTable.Cell>{p.title}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="subdued">
                            {p.vendorShopId}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <InlineStack gap="100" blockAlign="center">
                            <Badge tone="warning">{p.regressionFrom ?? ""}</Badge>
                            <Text as="span" tone="subdued">
                              →
                            </Text>
                            <Badge tone="critical">{p.regressionTo ?? ""}</Badge>
                          </InlineStack>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="subdued">
                            {p.regressedAt ? new Date(p.regressedAt).toLocaleString() : ""}
                          </Text>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>

            {/* Sync-eligible vendors */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Sync-eligible vendors ({eligible.length})
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    Only vendors using ShipTurtle's vendor-sync. Others can be mapped manually from Vendors.
                  </Text>
                </InlineStack>

                {eligible.length === 0 ? (
                  <EmptyState
                    heading="No sync-eligible vendors yet"
                    action={{ content: "Open Vendors tab", url: "/vendors" }}
                    image=""
                  >
                    <p>Go to Vendors and click Refresh to pull approved vendors from ShipTurtle.</p>
                  </EmptyState>
                ) : (
                  <IndexTable
                    resourceName={{ singular: "vendor", plural: "vendors" }}
                    itemCount={eligible.length}
                    headings={[
                      { title: "Name" },
                      { title: "Brand" },
                      { title: "Mapped" },
                      { title: "Last sync" },
                      { title: "Sync enabled" },
                      { title: "" },
                    ]}
                    selectable={false}
                  >
                    {eligible.map((v, idx) => (
                      <IndexTable.Row id={v.id} key={v.id} position={idx}>
                        <IndexTable.Cell>
                          <BlockStack gap="050">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {v.title}
                            </Text>
                            <Text as="span" tone="subdued" variant="bodySm">
                              {v.domain}
                            </Text>
                          </BlockStack>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {v.brandName ? (
                            <Badge tone="info">{v.brandName}</Badge>
                          ) : (
                            <Badge tone="warning">unmapped</Badge>
                          )}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" tone="subdued">
                            {v.mappedProducts ?? 0}/{v.totalProducts ?? 0}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {v.lastSyncAt ? (
                            <InlineStack gap="100" blockAlign="center">
                              <Text as="span" tone="subdued" variant="bodySm">
                                {new Date(v.lastSyncAt).toLocaleString()}
                              </Text>
                              {v.lastSyncStatus === "ok" && <Badge tone="success">ok</Badge>}
                              {v.lastSyncStatus === "error" && <Badge tone="critical">err</Badge>}
                            </InlineStack>
                          ) : (
                            <Text as="span" tone="subdued">—</Text>
                          )}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Button
                            onClick={() => toggleVendor(v, !v.syncEnabled)}
                            variant={v.syncEnabled ? "primary" : "secondary"}
                            size="slim"
                          >
                            {v.syncEnabled ? "On" : "Off"}
                          </Button>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Tooltip content={v.brandId ? "Run pipeline for this vendor" : "Map a brand first"}>
                            <Button
                              size="slim"
                              onClick={() => runVendor(v)}
                              loading={busy === v.id}
                              disabled={busy === v.id || !v.brandId}
                            >
                              Run now
                            </Button>
                          </Tooltip>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

