import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  EmptyState,
  Filters,
  IndexTable,
  InlineStack,
  Page,
  Pagination,
  Select,
  Spinner,
  Text,
} from "@shopify/polaris";
import { api } from "../api";

const PAGE_SIZE = 50;

export default function Vendors() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState(0);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncedOnly, setSyncedOnly] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (opts: { search?: string; start?: number } = {}) => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api.searchVendors({
          search: opts.search ?? search,
          start: opts.start ?? start,
          length: PAGE_SIZE,
        });
        setRows(r.data);
        setTotal(r.recordsTotal);
        setFiltered(r.recordsFiltered);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    },
    [search, start],
  );

  useEffect(() => {
    api.getBrands().then(setBrands).catch(() => {});
    fetchPage({ start: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setErr(null);
    try {
      await api.refreshVendors();
      await fetchPage({ start: 0 });
      setStart(0);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }, [fetchPage]);

  const setBrand = useCallback(
    async (v: any, brandId: string) => {
      const b = brands.find((x) => x.id === brandId);
      await api.patchVendor(v.id, { brandId: brandId || null, brandName: b?.name ?? null });
      fetchPage();
    },
    [brands, fetchPage],
  );

  const brandOptions = useMemo(
    () => [
      { label: "— choose brand —", value: "" },
      ...[...brands]
        .sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0)
        .map((b) => ({ label: b.name as string, value: b.id as string })),
    ],
    [brands],
  );

  const visible = useMemo(
    () => (syncedOnly ? rows.filter((v) => v.vendorType === "Using vendor sync") : rows),
    [rows, syncedOnly],
  );

  const handleClearAll = () => {
    setSearch("");
    setSyncedOnly(false);
    setStart(0);
    fetchPage({ search: "", start: 0 });
  };

  return (
    <Page
      title="Vendors"
      subtitle="Live data from ShipTurtle — search, map to a Toastd brand, drill into a vendor's products."
      primaryAction={{
        content: "Refresh from ShipTurtle",
        onAction: refresh,
        loading: busy === "refresh",
      }}
    >
      <BlockStack gap="400">
        {err && (
          <Banner tone="critical" onDismiss={() => setErr(null)}>
            <p>{err}</p>
          </Banner>
        )}

        <Card padding="0">
          <Filters
            queryValue={search}
            queryPlaceholder="Search vendors (case-sensitive — e.g. 'grytt')"
            onQueryChange={setSearch}
            onQueryClear={() => {
              setSearch("");
              setStart(0);
              fetchPage({ search: "", start: 0 });
            }}
            onClearAll={handleClearAll}
            filters={[
              {
                key: "synced-only",
                label: "Sync type",
                filter: (
                  <ChoiceList
                    title="Type"
                    titleHidden
                    choices={[
                      { label: "Only vendor-sync", value: "yes" },
                      { label: "All vendor types", value: "no" },
                    ]}
                    selected={syncedOnly ? ["yes"] : ["no"]}
                    onChange={(v) => setSyncedOnly(v[0] === "yes")}
                  />
                ),
                shortcut: true,
              },
            ]}
            appliedFilters={syncedOnly ? [{ key: "synced-only", label: "Only vendor-sync", onRemove: () => setSyncedOnly(false) }] : []}
          >
            <Button
              onClick={() => {
                setStart(0);
                fetchPage({ start: 0 });
              }}
            >
              Search
            </Button>
          </Filters>

          {loading ? (
            <Box padding="800">
              <InlineStack align="center" blockAlign="center" gap="200">
                <Spinner size="small" />
                <Text as="span" tone="subdued">
                  Loading…
                </Text>
              </InlineStack>
            </Box>
          ) : visible.length === 0 ? (
            <EmptyState heading="No vendors match" image="">
              <p>Try clearing the synced-only filter or refresh from ShipTurtle.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "vendor", plural: "vendors" }}
              itemCount={visible.length}
              headings={[
                { title: "Name" },
                { title: "Domain" },
                { title: "Type" },
                { title: "Mapped" },
                { title: "Brand mapping" },
                { title: "" },
              ]}
              selectable={false}
            >
              {visible.map((v, idx) => (
                <IndexTable.Row id={v.id} key={v.id} position={idx}>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {v.title}
                      </Text>
                      {v.companyName && (
                        <Text as="span" tone="subdued" variant="bodySm">
                          {v.companyName}
                        </Text>
                      )}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued">
                      {v.domain || "—"}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="100">
                      {v.vendorType === "Using vendor sync" ? (
                        <Badge tone="success">vendor sync</Badge>
                      ) : (
                        <Badge>{v.vendorType ?? "—"}</Badge>
                      )}
                      {v.isFrozen && <Badge tone="critical">frozen</Badge>}
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued">
                      {v.mappedProducts ?? 0}/{v.totalProducts ?? 0}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Box minWidth="180px">
                      <Select
                        label=""
                        labelHidden
                        options={brandOptions}
                        value={v.brandId ?? ""}
                        onChange={(val) => setBrand(v, val)}
                      />
                    </Box>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {v.domain ? (
                      <Button size="slim" onClick={() => nav(`/vendors/${v.id}`)}>
                        View products
                      </Button>
                    ) : (
                      <Text as="span" tone="subdued" variant="bodySm">
                        no shop
                      </Text>
                    )}
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" tone="subdued" variant="bodySm">
            Showing {rows.length === 0 ? 0 : start + 1}–{start + rows.length} of {filtered}
            {filtered !== total ? ` (filtered from ${total})` : ""}
          </Text>
          <Pagination
            hasPrevious={start > 0 && !loading}
            hasNext={start + rows.length < filtered && !loading}
            onPrevious={() => {
              const s = Math.max(0, start - PAGE_SIZE);
              setStart(s);
              fetchPage({ start: s });
            }}
            onNext={() => {
              const s = start + PAGE_SIZE;
              setStart(s);
              fetchPage({ start: s });
            }}
          />
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
