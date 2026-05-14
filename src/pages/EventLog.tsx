import { useEffect, useRef, useState } from "react";
import {
  Badge,
  BlockStack,
  Box,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { api, auth } from "../api";

type BadgeTone = "success" | "info" | "warning" | "critical" | undefined;

const toneByLevel: Record<string, BadgeTone> = {
  success: "success",
  error: "critical",
  warn: "warning",
  info: "info",
};

export default function EventLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [level, setLevel] = useState("");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      const r = await api.logs({ limit: 200, level: level || undefined });
      if (!cancelled) setLogs(r);
    }
    loadInitial();

    const u = new URL(api.logStreamUrl());
    if (auth.token) u.searchParams.set("token", auth.token);
    let es: EventSource | null = null;
    try {
      es = new EventSource(u.toString());
      esRef.current = es;
      es.addEventListener("log", (ev: any) => {
        try {
          const item = JSON.parse(ev.data);
          if (level && item.level !== level) return;
          setLogs((prev) => [item, ...prev].slice(0, 500));
        } catch {}
      });
      es.onerror = () => {
        es?.close();
        esRef.current = null;
      };
    } catch {
      // fall back to polling
    }

    const i = setInterval(() => {
      if (!esRef.current) loadInitial();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(i);
      es?.close();
    };
  }, [level]);

  return (
    <Page
      title="Event Log"
      subtitle="Live tail of sync and pipeline events. Streams via SSE; falls back to polling."
    >
      <BlockStack gap="400">
        <Card padding="0">
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodyMd" tone="subdued">
                Showing {logs.length} entries
              </Text>
              <Box minWidth="200px">
                <Select
                  label="Level"
                  labelHidden
                  options={[
                    { label: "All levels", value: "" },
                    { label: "info", value: "info" },
                    { label: "success", value: "success" },
                    { label: "warn", value: "warn" },
                    { label: "error", value: "error" },
                  ]}
                  value={level}
                  onChange={setLevel}
                />
              </Box>
            </InlineStack>
          </Box>

          {logs.length === 0 ? (
            <EmptyState heading="No log entries" image="">
              <p>When jobs run, events will stream here in real time.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "log", plural: "logs" }}
              itemCount={logs.length}
              headings={[
                { title: "Time" },
                { title: "Level" },
                { title: "Step" },
                { title: "Message" },
                { title: "Vendor" },
                { title: "Product" },
              ]}
              selectable={false}
            >
              {logs.map((l, i) => (
                <IndexTable.Row id={(l.id ?? "") + i} key={(l.id ?? "") + i} position={i}>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {new Date(l.ts).toLocaleString()}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={toneByLevel[l.level]}>{l.level}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {l.step ?? ""}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{l.message}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {l.vendorName ?? ""}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {l.productTitle ?? ""}
                    </Text>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
