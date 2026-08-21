import { open as opSQLiteOpen } from "@op-engineering/op-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { open as nitroOpen } from "react-native-nitro-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";

const ITERATIONS = 1000;
const COOL_DOWN_MS = 2500;

type BenchResult = { label: string; ms: number; group: string; color: string };
type BenchGroup = { title: string; results: BenchResult[] };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function cooldown() {
  // hint at GC by creating and dropping a large allocation
  let _sink: number[] | null = new Array(500_000).fill(0);
  _sink = null;
  await sleep(COOL_DOWN_MS);
}

// ── op-sqlite ─────────────────────────────────────────────────────────────────

async function benchOpSQLite(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  const db = opSQLiteOpen({ name: "op_bench.db" });

  db.executeSync("DROP TABLE IF EXISTS bench");
  db.executeSync(
    "CREATE TABLE bench (id INTEGER PRIMARY KEY, name TEXT, value REAL)",
  );

  await cooldown();
  // sync inserts
  let t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = db.executeSync("INSERT INTO bench VALUES (?,?,?)", [
      i,
      `n${i}`,
      i * 1.5,
    ]);
    void res.insertId;
    void res.rows.length
  }
  results.push({
    label: "op-sqlite",
    group: "sync insert",
    color: "#f97316",
    ms: performance.now() - t,
  });

  db.executeSync("DELETE FROM bench");
  await cooldown();

  // async inserts
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = await db.execute("INSERT INTO bench VALUES (?,?,?)", [
      i,
      `n${i}`,
      i * 1.5,
    ]);
    void res.insertId;
    void res.rows.length
  }
  results.push({
    label: "op-sqlite",
    group: "async insert",
    color: "#f97316",
    ms: performance.now() - t,
  });

  db.executeSync("DELETE FROM bench");
  await cooldown();

  // transaction inserts
  t = performance.now();
  await db.transaction(async (tx) => {
    for (let i = 0; i < ITERATIONS; i++) {
      await tx.execute("INSERT INTO bench VALUES (?,?,?)", [
        i,
        `n${i}`,
        i * 1.5,
      ]);
    }
  });
  results.push({
    label: "op-sqlite",
    group: "tx insert",
    color: "#f97316",
    ms: performance.now() - t,
  });

  await cooldown();

  // select with host objects
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await db.executeWithHostObjects("SELECT * FROM bench");
  }
  results.push({
    label: "op-sqlite (HostObjects)",
    group: "select + read props",
    color: "#f97316",
    ms: performance.now() - t,
  });

  await cooldown();

  // select + access props
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = await db.execute("SELECT * FROM bench");
    for (const row of res.rows) {
      void row["id"];
      void row["name"];
      void row["value"];
    }
  }
  results.push({
    label: "op-sqlite",
    group: "select + read props",
    color: "#f97316",
    ms: performance.now() - t,
  });

  db.executeSync("DROP TABLE IF EXISTS bench");
  db.close();
  await cooldown();

  return results;
}

// ── nitro-sqlite ───────────────────────────────────────────────────────────────

async function benchNitroSQLite(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  const conn = nitroOpen({ name: "nitro_bench.db" });

  conn.execute("DROP TABLE IF EXISTS bench");
  conn.execute(
    "CREATE TABLE bench (id INTEGER PRIMARY KEY, name TEXT, value REAL)",
  );

  // sync inserts
  let t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = conn.execute("INSERT INTO bench VALUES (?,?,?)", [
      i,
      `n${i}`,
      i * 1.5,
    ]);
    void res.insertId;
        void res.rows.length
  }
  results.push({
    label: "nitro-sqlite",
    group: "sync insert",
    color: "#a78bfa",
    ms: performance.now() - t,
  });

  conn.execute("DELETE FROM bench");
  await cooldown();

  // async inserts
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = await conn.executeAsync("INSERT INTO bench VALUES (?,?,?)", [
      i,
      `n${i}`,
      i * 1.5,
    ]);
    void res.insertId;
        void res.rows.length
  }
  results.push({
    label: "nitro-sqlite",
    group: "async insert",
    color: "#a78bfa",
    ms: performance.now() - t,
  });

  conn.execute("DELETE FROM bench");
  await cooldown();

  // transaction inserts
  t = performance.now();
  await conn.transaction(async (tx) => {
    for (let i = 0; i < ITERATIONS; i++) {
      await tx.executeAsync("INSERT INTO bench VALUES (?,?,?)", [
        i,
        `n${i}`,
        i * 1.5,
      ]);
    }
  });
  results.push({
    label: "nitro-sqlite",
    group: "tx insert",
    color: "#a78bfa",
    ms: performance.now() - t,
  });

  await cooldown();

  // select + access props
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = await conn.executeAsync("SELECT * FROM bench");
    for (const row of res.rows._array) {
      void row["id"];
      void row["name"];
      void row["value"];
    }
  }
  results.push({
    label: "nitro-sqlite",
    group: "select + read props",
    color: "#a78bfa",
    ms: performance.now() - t,
  });

  conn.execute("DROP TABLE IF EXISTS bench");
  conn.close();
  await cooldown();

  return results;
}

// ── expo-sqlite ────────────────────────────────────────────────────────────────

async function benchExpoSQLite(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];
  const db = openDatabaseSync("expo_bench.db");

  db.execSync("DROP TABLE IF EXISTS bench");
  db.execSync(
    "CREATE TABLE bench (id INTEGER PRIMARY KEY, name TEXT, value REAL)",
  );

  // sync inserts
  let t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = db.runSync("INSERT INTO bench VALUES (?,?,?)", i, `n${i}`, i * 1.5);
    void res.lastInsertRowId;
  }
  results.push({
    label: "expo-sqlite",
    group: "sync insert",
    color: "#34d399",
    ms: performance.now() - t,
  });

  db.execSync("DELETE FROM bench");
  await cooldown();

  // async inserts
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const res = await db.runAsync("INSERT INTO bench VALUES (?,?,?)", i, `n${i}`, i * 1.5);
    void res.lastInsertRowId;
  }
  results.push({
    label: "expo-sqlite",
    group: "async insert",
    color: "#34d399",
    ms: performance.now() - t,
  });

  db.execSync("DELETE FROM bench");
  await cooldown();

  // transaction inserts
  t = performance.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = 0; i < ITERATIONS; i++) {
      await txn.runAsync(
        "INSERT INTO bench VALUES (?,?,?)",
        i,
        `n${i}`,
        i * 1.5,
      );
    }
  });
  results.push({
    label: "expo-sqlite",
    group: "tx insert",
    color: "#34d399",
    ms: performance.now() - t,
  });

  await cooldown();

  // select + access props
  t = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const rows = await db.getAllAsync<{
      id: number;
      name: string;
      value: number;
    }>("SELECT * FROM bench");
    for (const row of rows) {
      void row.id;
      void row.name;
      void row.value;
    }
  }
  results.push({
    label: "expo-sqlite",
    group: "select + read props",
    color: "#34d399",
    ms: performance.now() - t,
  });

  db.execSync("DROP TABLE IF EXISTS bench");
  db.closeSync();
  await cooldown();

  return results;
}

// ── component ─────────────────────────────────────────────────────────────────

function groupResults(results: BenchResult[]): BenchGroup[] {
  const map = new Map<string, BenchResult[]>();
  for (const r of results) {
    if (!map.has(r.group)) map.set(r.group, []);
    map.get(r.group)!.push(r);
  }
  return Array.from(map, ([title, results]) => ({ title, results }));
}

export default function HomeScreen() {
  const [results, setResults] = useState<BenchResult[]>([]);
  const [status, setStatus] = useState("starting…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        setStatus("running op-sqlite…");
        const opResults = await benchOpSQLite();
        setResults(opResults);

        setStatus("running nitro-sqlite…");
        const nitroResults = await benchNitroSQLite();
        setResults((prev) => [...prev, ...nitroResults]);

        setStatus("running expo-sqlite…");
        const expoResults = await benchExpoSQLite();
        setResults((prev) => [...prev, ...expoResults]);

        setStatus("done");
      } catch (e: any) {
        setStatus(`error: ${e?.message ?? e}`);
      }
    })();
  }, []);

  const groups = groupResults(results);
  const maxMs = Math.max(...results.map((r) => r.ms), 1);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>SQLite Benchmark</Text>
      <Text style={styles.sub}>
        {ITERATIONS} rows · {COOL_DOWN_MS}ms cooldown between tests
      </Text>
      {status !== "done" && <Text style={styles.status}>{status}</Text>}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {groups.map((group) => (
          <View key={group.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
            </View>
            {group.results.map((r) => {
              const pct = r.ms / maxMs;
              return (
                <View key={r.label} style={styles.barRow}>
                  <View style={styles.barMeta}>
                    <Text style={[styles.label, { color: r.color }]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.ms, { color: r.color }]}>
                      {r.ms.toFixed(1)} ms
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${pct * 100}%` as `${number}%`,
                          backgroundColor: r.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footnote}>
          * Host/Hybrid Objects shift some cost to runtime — property access
          triggers the JSI conversion lazily rather than upfront.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f", paddingHorizontal: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 16 },
  sub: { fontSize: 13, color: "#888", marginBottom: 4 },
  status: { fontSize: 14, color: "#f0a500", marginBottom: 12 },
  scroll: { flex: 1 },
  list: { gap: 16, paddingBottom: 40 },
  section: { gap: 8 },
  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 2,
  },
  sectionTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  barRow: {
    gap: 4,
  },
  barMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  label: { color: "#ddd", fontSize: 12, flexShrink: 1, marginRight: 8 },
  ms: { fontSize: 12, fontWeight: "600", flexShrink: 0 },
  barTrack: {
    height: 10,
    backgroundColor: "#1c1c1e",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  footnote: { fontSize: 11, color: "#555", lineHeight: 16, paddingTop: 8 },
});
