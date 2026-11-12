/** Exercise the installed Host operations with private data and a local New API fixture. */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { apply, extractSelfWallet, extractWalletBody } from '../src/index.js'

function mount(home) {
  let route
  let tool
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    apply({
      effect: effect => effect(),
      webServer: { register: value => { route = value; return () => {} } },
      timer: { interval: () => () => {}, timeout: () => () => {} },
      get: name => name === 'tools' ? { register: value => { tool = value; return () => {} } } : undefined,
    })
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
  return { route, tool }
}

async function fixture(t, sites = []) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-new-api-test-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  await mkdir(join(home, 'dsh-new-api'))
  await writeFile(join(home, 'dsh-new-api', 'sites.json'), JSON.stringify({ sites }))
  return { home, ...mount(home) }
}

async function request(route, action, payload, overrides = {}) {
  const incoming = Readable.from([Buffer.from(overrides.body ?? JSON.stringify({ action, payload }))])
  incoming.method = overrides.method ?? 'POST'
  incoming.socket = {}
  incoming.headers = {
    host: 'localhost',
    origin: 'http://localhost',
    'x-dsh-new-api': '1',
    ...overrides.headers,
  }
  let status
  let headers
  let body
  await route.handler(incoming, {
    headersSent: false,
    writeHead(code, values) { status = code; headers = values },
    end(value) { body = JSON.parse(value) },
  })
  return { status, headers, body }
}

test('a zero wallet balance remains distinct from an unsupported wallet', () => {
  assert.deepEqual(extractSelfWallet({ wallet_quota: '0' }), { remaining: 0 })
  assert.deepEqual(extractWalletBody({ success: true, data: { wallet: { balance: 42 } } }), { remaining: 42 })
  assert.equal(extractSelfWallet({ quota: 42 }), null)
  assert.equal(extractWalletBody({ success: false, data: { wallet_quota: 42 } }), null)
  assert.equal(extractSelfWallet({ wallet_quota: -1 }), null)
})

test('the renamed route serves an empty console with the original schedule defaults', async t => {
  const { route } = await fixture(t)
  const result = await request(route, 'getState')
  assert.equal(route.path, '/dsh-new-api/api')
  assert.equal(result.status, 200)
  assert.equal(result.headers['cache-control'], 'no-store')
  assert.equal(result.body.ok, true)
  assert.deepEqual(result.body.data.sites, [])
  assert.deepEqual(result.body.data.settings, {
    autoCheckInEnabled: true, dailyTime: '09:00', jitterMinutes: 30, requestTimeoutMs: 20_000,
  })
})

test('the route rejects cross-site requests and malformed JSON before dispatch', async t => {
  const { route } = await fixture(t)
  for (const headers of [
    { 'x-dsh-new-api': undefined },
    { origin: 'https://another.example' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    assert.equal((await request(route, 'getState', undefined, { headers })).status, 403)
  }
  assert.equal((await request(route, 'getState', undefined, { method: 'GET' })).status, 405)
  assert.equal((await request(route, 'getState', undefined, { body: '{' })).status, 400)
})

test('saved schedule settings reload from the renamed data directory', async t => {
  const { home, route } = await fixture(t)
  const settings = { autoCheckInEnabled: false, dailyTime: '12:34', jitterMinutes: 7 }
  assert.equal((await request(route, 'saveSettings', { settings })).body.ok, true)
  const reloaded = await request(mount(home).route, 'getState')
  assert.deepEqual(reloaded.body.data.settings, { ...settings, requestTimeoutMs: 20_000 })
  assert.equal((await request(route, 'saveSettings', { dailyTime: '25:00' })).body.ok, false)
})

test('browser and agent reads mask stored credentials and deletion survives a reload', async t => {
  const token = 'sk-fixture-token-1234567890'
  const cookie = 'session=fixture-session-1234567890'
  const { home, route, tool } = await fixture(t, [{
    id: 'fixture-site', baseUrl: 'https://example.invalid', token, cookie, authMode: 'bearer', enabled: false,
  }])
  const browser = (await request(route, 'getState')).body.data
  const agent = await tool.execute({ action: 'list' })
  assert.equal(browser.sites[0].hasToken, true)
  assert.equal(browser.sites[0].hasCookie, true)
  assert.equal(JSON.stringify(browser).includes(token), false)
  assert.equal(JSON.stringify(browser).includes(cookie), false)
  assert.equal(JSON.stringify(tool.output.render({}, agent)).includes(token), false)
  assert.equal(JSON.stringify(agent).includes(cookie), false)
  assert.equal((await request(route, 'removeSite', { id: 'fixture-site' })).body.ok, true)
  assert.deepEqual((await request(mount(home).route, 'getState')).body.data.sites, [])
})

test('the browser module registers the renamed console in both locales', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8')
  let module
  runInNewContext(source, {
    URL,
    document: { baseURI: 'http://localhost/' },
    window: { __ModuleLoader__: { load: value => { module = value } } },
  })
  assert.equal(module.id, manifest.name)
  const plugin = module.factory(() => ({ createElement() {} }))
  let dictionary
  let section
  plugin.apply({
    effect: effect => effect(),
    locale: {
      register: (_name, values) => { dictionary = values; return () => {} },
      bind: () => key => dictionary.en[key],
    },
    slots: {
      inject: (_name, effect) => effect(),
      register: value => { section = value; return () => {} },
    },
  })
  assert.equal(section.label(), 'New API console')
  assert.equal(dictionary.zh.nav, 'New API 管理台')
})

test('a New API site can be added and checked in without repeating an accepted check-in', async t => {
  let checkIns = 0
  const server = createServer((incoming, response) => {
    const path = new URL(incoming.url, 'http://localhost').pathname
    let data
    if (path === '/api/status') data = { system_name: 'Fixture site', checkin_enabled: true, quota_per_unit: 500_000 }
    else if (path === '/api/user/self') data = { id: 42, quota: 1_000_000, used_quota: 500_000, wallet_quota: 0 }
    else if (path === '/api/user/checkin' && incoming.method === 'GET') data = { stats: { checked_in_today: checkIns > 0 } }
    else if (path === '/api/user/checkin' && incoming.method === 'POST') { checkIns += 1; data = { quota_awarded: 100 } }
    else { response.writeHead(404); response.end(); return }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: true, data }))
  })
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { home, route } = await fixture(t)
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const added = await request(route, 'addSite', { baseUrl, token: 'sk-fixture-1234567890', authMode: 'bearer', autoCheckIn: false })
  assert.equal(added.body.ok, true)
  const site = added.body.data.site
  assert.equal(site.quota.usd, 2)
  assert.equal(site.quota.wallet.remaining, 0)
  const first = await request(route, 'checkInSite', { id: site.id })
  assert.equal(first.body.data.result.status, 'success')
  assert.equal(first.body.data.result.quotaAwarded, 100)
  assert.equal((await request(route, 'checkInSite', { id: site.id })).body.data.result.status, 'already')
  assert.equal(checkIns, 1)
  const persisted = JSON.parse(await readFile(join(home, 'dsh-new-api', 'sites.json'), 'utf8'))
  assert.equal(persisted.sites[0].last.status, 'already')
})
