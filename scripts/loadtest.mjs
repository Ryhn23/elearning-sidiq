#!/usr/bin/env node
/**
 * Load test sederhana (tanpa dependensi) untuk E-Learning API.
 *
 * Pemakaian:
 *   node scripts/loadtest.mjs                          # default: http://localhost:8080, 20 concurrent x 100 req
 *   BASE_URL=http://localhost:3000 CONCURRENCY=50 TOTAL=500 node scripts/loadtest.mjs
 *
 * Endpoint yang diuji (read-only, aman untuk data produksi):
 *   GET /health, GET /api/v1/courses, GET /api/v1/categories
 */

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);
const TOTAL = Number(process.env.TOTAL || 100);
const ENDPOINTS = ['/health', '/api/v1/courses', '/api/v1/categories'];

const latencies = [];
let okCount = 0;
let errCount = 0;
let bytesIn = 0;

async function worker() {
  for (let i = 0; i < TOTAL / CONCURRENCY; i++) {
    const path = ENDPOINTS[i % ENDPOINTS.length];
    const t0 = performance.now();
    try {
      const res = await fetch(BASE + path, { signal: AbortSignal.timeout(10_000) });
      const body = await res.text();
      bytesIn += Buffer.byteLength(body);
      if (res.ok) okCount++;
      else errCount++;
    } catch {
      errCount++;
    }
    latencies.push(performance.now() - t0);
  }
}

console.log(`Load test: ${BASE}`);
console.log(`Concurrency: ${CONCURRENCY} | Total requests: ${TOTAL} | Endpoints: ${ENDPOINTS.join(', ')}`);
console.log('---');

const t0 = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
const totalMs = performance.now() - t0;

latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];

console.log(`Selesai dalam ${(totalMs / 1000).toFixed(2)}s`);
console.log(`Throughput: ${(TOTAL / (totalMs / 1000)).toFixed(1)} req/s | ${(bytesIn / 1024 / (totalMs / 1000)).toFixed(1)} KB/s`);
console.log(`OK: ${okCount} | Error: ${errCount}`);
console.log(`Latency ms — p50: ${p(0.5).toFixed(1)} | p95: ${p(0.95).toFixed(1)} | p99: ${p(0.99).toFixed(1)} | max: ${latencies[latencies.length - 1].toFixed(1)}`);

process.exit(errCount > 0 ? 1 : 0);
