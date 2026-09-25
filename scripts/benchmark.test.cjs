const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const file = path.join(__dirname, "../src/benchmark/statistics.ts");
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsFromModule = {};
new Function("exports", compiled)(exportsFromModule);
const { summarize } = exportsFromModule;

test("summarizes individual samples with an order-independent median and spread", () => {
  const samples = [9, 1, 5, 3].map((ms, index) => ({ library: "op-sqlite", caseId: "read", round: index + 1, ms, checksum: 10 }));
  assert.deepEqual(summarize(samples, []), [{
    library: "op-sqlite", caseId: "read", medianMs: 4, minMs: 1, maxMs: 9, samples: [9, 1, 5, 3],
  }]);
});

test("suppresses a summary when any round failed, while preserving other cases", () => {
  const samples = [
    { library: "op-sqlite", caseId: "read", round: 1, ms: 4, checksum: 10 },
    { library: "expo-sqlite", caseId: "read", round: 1, ms: 8, checksum: 10 },
  ];
  const failures = [{ library: "op-sqlite", caseId: "read", round: 2, message: "wrong row" }];
  assert.deepEqual(summarize(samples, failures), [{
    library: "expo-sqlite", caseId: "read", medianMs: 8, minMs: 8, maxMs: 8, samples: [8],
  }]);
});
