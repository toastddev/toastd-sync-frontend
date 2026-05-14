import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineGrid,
  InlineStack,
  Link,
  Page,
  Pagination,
  Select,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { api } from "../api";

const PAGE_SIZE = 50;

export default function VendorProducts() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [vendor, setVendor] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [filtered, setFiltered] = useState(0);
  const [start, setStart] = useState(0);
  const [search, setSearch] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mappingFilter, setMappingFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [noShopMessage, setNoShopMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadVendor = useCallback(async () => {
    if (!id) return;
    try {
      const v = await api.getVendor(id);
      setVendor(v);
    } catch {
      setVendor(null);
    }
  }, [id]);

  const fetchPage = useCallback(
    async (opts: { start?: number } = {}) => {
      if (!id) return;
      setLoading(true);
      setErr(null);
      try {
        const filters: any = {};
        if (titleFilter) filters.title = titleFilter;
        if (statusFilter) filters.status = statusFilter;
        if (mappingFilter) filters.mapping_status = mappingFilter;
        if (productTypeFilter) filters.product_type = productTypeFilter;
        if (tagsFilter) filters.tags = tagsFilter;
        const r = await api.searchVendorProducts(id, {
          search,
          start: opts.start ?? start,
          length: PAGE_SIZE,
          filters: Object.keys(filters).length ? filters : undefined,
        });
        setProducts(r.data);
        setTotal(r.recordsTotal);
        setFiltered(r.recordsFiltered);
        setNoShopMessage((r as any).noShop ? (r as any).message ?? "This vendor has no Shopify shop." : null);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    },
    [id, search, start, titleFilter, statusFilter, mappingFilter, productTypeFilter, tagsFilter],
  );

  useEffect(() => {
    loadVendor();
    fetchPage({ start: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clearFilters = () => {
    setSearch("");
    setTitleFilter("");
    setStatusFilter("");
    setMappingFilter("");
    setProductTypeFilter("");
    setTagsFilter("");
    setStart(0);
    setTimeout(() => fetchPage({ start: 0 }), 0);
  };

  const mapOne = useCallback(
    async (p: any) => {
      if (!id) return;
      if (!vendor?.brandId) {
        setErr("Set a brand mapping for this vendor first.");
        return;
      }
      setBusy(String(p.alienProductId));
      try {
        await api.syncProduct(id, p.alienProductId);
        setTimeout(() => fetchPage(), 1500);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setBusy(null);
      }
    },
    [id, vendor, fetchPage],
  );

  return (
    <Page
      backAction={{ content: "Vendors", onAction: () => nav("/vendors") }}
      title={vendor?.title ?? `Vendor #${id}`}
      titleMetadata={
        <InlineStack gap="100">
          {vendor?.domain ? (
            <Badge tone="info">{vendor.domain}</Badge>
          ) : (
            <Badge>no shop</Badge>
          )}
          {vendor?.brandName ? (
            <Badge tone="info">{vendor.brandName}</Badge>
          ) : (
            <Badge tone="warning">no brand mapped</Badge>
          )}
          {vendor?.vendorType && <Badge>{vendor.vendorType}</Badge>}
        </InlineStack>
      }
    >
      <BlockStack gap="400">
        {err && (
          <Banner tone="critical" onDismiss={() => setErr(null)}>
            <p>{err}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <TextField
              label="Global search"
              labelHidden
              placeholder="Global search (case-sensitive — e.g. 'BANGLE')"
              value={search}
              onChange={setSearch}
              autoComplete="off"
              connectedRight={
                <Button
                  onClick={() => {
                    setStart(0);
                    fetchPage({ start: 0 });
                  }}
                >
                  Search
                </Button>
              }
            />
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="200">
              <TextField
                label="Exact title"
                value={titleFilter}
                onChange={setTitleFilter}
                autoComplete="off"
              />
              <Select
                label="Status"
                options={[
                  { label: "All statuses", value: "" },
                  { label: "active", value: "active" },
                  { label: "draft", value: "draft" },
                  { label: "archived", value: "archived" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <Select
                label="Mapping"
                options={[
                  { label: "All mapping", value: "" },
                  { label: "UNMAPPED", value: "UNMAPPED" },
                  { label: "PARTIALLY_MAPPED", value: "PARTIALLY_MAPPED" },
                  { label: "FULLY_MAPPED", value: "FULLY_MAPPED" },
                ]}
                value={mappingFilter}
                onChange={setMappingFilter}
              />
              <TextField
                label="Product type"
                value={productTypeFilter}
                onChange={setProductTypeFilter}
                autoComplete="off"
              />
              <TextField
                label="Tags contain"
                value={tagsFilter}
                onChange={setTagsFilter}
                autoComplete="off"
              />
            </InlineGrid>
            <InlineStack gap="200">
              <Button
                variant="primary"
                onClick={() => {
                  setStart(0);
                  fetchPage({ start: 0 });
                }}
              >
                Apply filters
              </Button>
              <Button onClick={clearFilters}>Clear all</Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card padding="0">
          {loading ? (
            <Box padding="800">
              <InlineStack align="center" gap="200">
                <Spinner size="small" />
                <Text as="span" tone="subdued">Loading…</Text>
              </InlineStack>
            </Box>
          ) : noShopMessage ? (
            <Box padding="400">
              <Banner tone="warning" title="No Shopify shop for this vendor">
                <p>{noShopMessage}</p>
              </Banner>
            </Box>
          ) : products.length === 0 ? (
            <EmptyState heading="No products match" image="">
              <p>Try clearing filters or refreshing this vendor's products.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={products.length}
              headings={[
                { title: "" },
                { title: "Title" },
                { title: "Mapping" },
                { title: "Pipeline" },
                { title: "Steps" },
                { title: "" },
              ]}
              selectable={false}
            >
              {products.map((p, idx) => {
                const productUrl =
                  vendor?.domain && p.handle ? `https://${vendor.domain}/products/${p.handle}` : null;
                const isActive = p.status === "active";
                const alreadyStartedSync = !!p.step1?.completedAt;
                const canMap = isActive || alreadyStartedSync;
                return (
                  <IndexTable.Row id={String(p.id)} key={p.id} position={idx}>
                    <IndexTable.Cell>
                      {p.image ? (
                        <Thumbnail source={p.image} alt={p.title} size="small" />
                      ) : (
                        <Box width="40px" />
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="semibold">
                          {p.title}
                        </Text>
                        <InlineStack gap="100" blockAlign="center">
                          <Text as="span" tone="subdued" variant="bodySm">
                            id {p.alienProductId}
                          </Text>
                          {p.status && (
                            <Badge
                              tone={
                                p.status === "active"
                                  ? "success"
                                  : p.status === "draft"
                                  ? "warning"
                                  : undefined
                              }
                            >
                              {p.status}
                            </Badge>
                          )}
                        </InlineStack>
                        {productUrl && (
                          <Link url={productUrl} target="_blank" removeUnderline>
                            <Text as="span" tone="success" variant="bodySm">
                              {productUrl}
                            </Text>
                          </Link>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        {p.mappingStatus === "FULLY_MAPPED" ? (
                          <Badge tone="success">fully</Badge>
                        ) : p.mappingStatus === "PARTIALLY_MAPPED" ? (
                          <Badge tone="warning">partial</Badge>
                        ) : (
                          <Badge tone="critical">unmapped</Badge>
                        )}
                        {p.regressedAt && (
                          <Text as="span" tone="critical" variant="bodySm">
                            regressed {p.regressionFrom}→{p.regressionTo}
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Badge
                          tone={
                            p.pipelineStatus === "done"
                              ? "success"
                              : p.pipelineStatus === "error"
                              ? "critical"
                              : p.pipelineStatus === "running"
                              ? "info"
                              : undefined
                          }
                        >
                          {p.pipelineStatus ?? "pending"}
                        </Badge>
                        {p.lastError && (
                          <Text as="span" tone="critical" variant="bodySm" truncate>
                            {p.lastError}
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" variant="bodySm">
                          {p.step1?.completedAt ? "1✓" : "1·"}{" "}
                          {p.step2?.completedAt ? "2✓" : "2·"}{" "}
                          {p.step3?.completedAt ? "3✓" : "3·"}
                        </Text>
                        {p.step3?.toastdProductId && (
                          <Text as="span" tone="subdued" variant="bodySm">
                            {p.step3.toastdProductId.slice(0, 8)}…
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <BlockStack gap="100">
                        <Button
                          size="slim"
                          onClick={() => mapOne(p)}
                          loading={busy === String(p.alienProductId)}
                          disabled={busy === String(p.alienProductId) || !vendor?.brandId || !canMap}
                        >
                          Map
                        </Button>
                        {!isActive && !alreadyStartedSync && (
                          <Text as="span" tone="subdued" variant="bodySm">
                            only active synced
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </Card>

        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" tone="subdued" variant="bodySm">
            Showing {products.length === 0 ? 0 : start + 1}–{start + products.length} of {filtered}
            {filtered !== total ? ` (filtered from ${total})` : ""}
          </Text>
          <Pagination
            hasPrevious={start > 0 && !loading}
            hasNext={start + products.length < filtered && !loading}
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
