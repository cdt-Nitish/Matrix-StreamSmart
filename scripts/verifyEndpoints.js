/**
 * scripts/verifyEndpoints.js
 *
 * Verifies all route prefixes, SPA fallback serving, and JSON API endpoints:
 * 1. GET / (Accept: text/html) -> React SPA
 * 2. GET /dashboard (Accept: text/html) -> React SPA
 * 3. GET /api -> API index
 * 4. GET /api/health
 * 5. GET /api/workbench
 * 6. GET /api/simulator
 * 7. GET /api/analytics
 * 8. GET /api/admin
 * 9. GET /api/auth
 * 10. GET /api/analytics/summary
 * 11. GET /api/analytics/sessions/1/report
 * 12. GET /api/workbench/videos
 * 13. GET /api/workbench/profiles
 */

const http = require('http');
const db = require('../config/db');
const { app } = require('../server');

async function run() {
  console.log('🔍 Starting StreamSmart Full-Stack & Route Verification...\n');

  // Verify DB connection
  try {
    await db.initializeAndConnect();
    console.log('✅ Database connected.\n');
  } catch (err) {
    console.warn('⚠️ Running without live DB connection:', err.message);
  }

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const endpoints = [
    { method: 'GET', path: '/', headers: { 'Accept': 'text/html' }, expectHtml: true },
    { method: 'GET', path: '/dashboard', headers: { 'Accept': 'text/html' }, expectHtml: true },
    { method: 'GET', path: '/api' },
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/workbench' },
    { method: 'GET', path: '/api/simulator' },
    { method: 'GET', path: '/api/analytics' },
    { method: 'GET', path: '/api/admin' },
    { method: 'GET', path: '/api/auth' },
    { method: 'GET', path: '/api/analytics/summary' },
    { method: 'GET', path: '/api/analytics/sessions/1/report' },
    { method: 'GET', path: '/api/workbench/videos' },
    { method: 'GET', path: '/api/workbench/profiles' }
  ];

  let passed = 0;

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: ep.headers || {}
      });
      const is200 = res.status === 200;

      if (ep.expectHtml) {
        const text = await res.text();
        const hasHtml = text.includes('<!DOCTYPE html>') && text.includes('root');
        if (is200 && hasHtml) {
          passed++;
          console.log(`✅ [200 OK HTML SPA] ${ep.method} ${ep.path} -> Successfully served React App index.html`);
        } else {
          console.error(`❌ HTML route ${ep.path} failed: status ${res.status}`);
        }
      } else {
        const data = await res.json();
        if (is200) {
          passed++;
          console.log(`✅ [200 OK JSON API] ${ep.method} ${ep.path}`);
          if (ep.path === '/api/analytics' || ep.path === '/api/analytics/summary') {
            console.log(`   Total Sessions: ${data.totalSessions}, Avg Startup: ${data.avgStartupDelayMs}ms, Cache Hit Rate: ${data.cacheHitRate}%`);
          }
        } else {
          console.error(`❌ [${res.status}] ${ep.method} ${ep.path}:`, data);
        }
      }
    } catch (err) {
      console.error(`❌ Error calling ${ep.path}:`, err.message);
    }
    console.log('');
  }

  server.close();

  console.log(`\n========================================`);
  console.log(`Verification: ${passed}/${endpoints.length} endpoints passed.`);
  console.log(`========================================\n`);

  if (passed === endpoints.length) {
    console.log('🎉 ALL FULL-STACK & FRONTEND ROUTES OPERATIONAL AND VERIFIED!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
