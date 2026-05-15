import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Server-confirmed: alienProductIds the backend is running or has queued for this vendor.
  const [serverActive, setServerActive] = useState<Set<number>>(new Set());
  // Optimistic: ids we just clicked but haven't yet seen reflected on the server.
  const [localPending, setLocalPending] = useState<Set<number>>(new Set());
  const [queueDepth, setQueueDepth] = useState(0);
  const [currentJob, setCurrentJob] = useState<any | null>(null);
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

  const activeIds = useMemo(() => {
    const s = new Set<number>(serverActive);
    localPending.forEach((x) => s.add(x));
    return s;
  }, [serverActive, localPending]);

  // Latest serverActive snapshot for the polling closure — lets us detect
  // "just finished" transitions without re-creating the interval on every tick.
  const prevServerActiveRef = useRef<Set<number>>(new Set());
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => { fetchPageRef.current = fetchPage; }, [fetchPage]);

  // Poll sync status every 2 s. Cheap (in-memory on backend) and lets us
  // reflect queue progress without per-product subscriptions. Always-on while
  // the page is mounted so a user returning to the tab sees queued items
  // already in progress from a previous session.
  useEffect(() => {
    if (!vendor?.vendorShopId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await api.syncStatus();
        if (cancelled) return;
        setCurrentJob(st.current);
        setQueueDepth(st.queueDepth ?? 0);
        const next = new Set<number>();
        const cur = st.current;
        if (
          cur &&
          cur.status === "running" &&
          cur.trigger === "manual_product" &&
          cur.vendorShopId === vendor.vendorShopId &&
          typeof cur.alienProductId === "number"
        ) {
          next.add(cur.alienProductId);
        }
        for (const q of st.queue ?? []) {
          if (q.vendorShopId === vendor.vendorShopId) next.add(q.alienProductId);
        }
        // Items that were active and are no longer → finished. Refetch the
        // page so the new pipeline status / mapping badge shows up.
        const prev = prevServerActiveRef.current;
        let anyFinished = false;
        for (const id of prev) {
          if (!next.has(id)) { anyFinished = true; break; }
        }
        prevServerActiveRef.current = next;
        setServerActive(next);
        // Anything the server now knows about is no longer "local-only".
        setLocalPending((lp) => {
          if (lp.size === 0) return lp;
          let changed = false;
          const out = new Set(lp);
          for (const id of next) {
            if (out.delete(id)) changed = true;
          }
          return changed ? out : lp;
        });
        if (anyFinished) fetchPageRef.current();
      } catch {
        // swallow — UI doesn't need to surface poll errors
      }
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vendor?.vendorShopId]);

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
      const alienId = Number(p.alienProductId);
      // Already running / queued / mid-click — let the existing slot finish.
      if (activeIds.has(alienId)) return;
      // Lock the button synchronously so a double-click can't fire two requests
      // in the same React tick. The polling effect will move this id from
      // localPending into serverActive once the server confirms.
      setLocalPending((lp) => {
        const next = new Set(lp);
        next.add(alienId);
        return next;
      });
      try {
        await api.syncProduct(id, alienId);
      } catch (e: any) {
        // Roll back the optimistic lock so the user can retry.
        setLocalPending((lp) => {
          if (!lp.has(alienId)) return lp;
          const next = new Set(lp);
          next.delete(alienId);
          return next;
        });
        setErr(e.message ?? "Failed to queue product");
      }
    },
    [id, vendor, activeIds],
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

        {(activeIds.size > 0 || queueDepth > 0) && (
          <Banner tone="info" title={activeIds.size > 0 ? "Mapping in progress" : "Queue has items"}>
            <BlockStack gap="100">
              {currentJob?.status === "running" && currentJob.trigger === "manual_product" && (
                <Text as="p" variant="bodySm">
                  Now mapping{" "}
                  <Text as="span" fontWeight="semibold">
                    {currentJob.currentProductTitle ?? `#${currentJob.alienProductId}`}
                  </Text>
                  .
                </Text>
              )}
              <Text as="p" variant="bodySm" tone="subdued">
                {queueDepth} queued across all vendors · {activeIds.size} for this vendor. Click Map on
                more products to add them to the queue.
              </Text>
            </BlockStack>
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
                        {(() => {
                          const inFlight = activeIds.has(Number(p.alienProductId));
                          const isCurrent =
                            currentJob &&
                            currentJob.status === "running" &&
                            currentJob.trigger === "manual_product" &&
                            currentJob.vendorShopId === vendor?.vendorShopId &&
                            currentJob.alienProductId === Number(p.alienProductId);
                          return (
                            <>
                              <Button
                                size="slim"
                                onClick={() => mapOne(p)}
                                loading={inFlight}
                                disabled={inFlight || !vendor?.brandId || !canMap}
                              >
                                {inFlight ? (isCurrent ? "Mapping…" : "Queued") : "Map"}
                              </Button>
                              {!isActive && !alreadyStartedSync && (
                                <Text as="span" tone="subdued" variant="bodySm">
                                  only active synced
                                </Text>
                              )}
                            </>
                          );
                        })()}
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
