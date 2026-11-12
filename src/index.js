/**
 * New API 管理台 — Host half.
 *
 * Owns durable site records (JSON under $DSH_HOME/dsh-new-api/), the daily
 * check-in scheduler, the New API HTTP client, an exact Web route used by the
 * Client half (`POST /dsh-new-api/api`), and an optional agent tool.
 *
 * Two authentication eras are supported per site:
 *  - "bearer": modern New API (v1.0.0-rc.x, e.g. api.ark717.com) reads only
 *    `Authorization: Bearer <access token / PAT>`; cookies are ignored.
 *  - "cookie": legacy New API / One API (0.x) needs `Cookie: session=<sid>`
 *    AND `New-Api-User: <numeric id>`.
 *
 * The route requires the authenticated DSH browser session and a custom header,
 * so cross-site forms and unauthenticated callers cannot reach stored secrets.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const inject = ['webServer', 'timer', 'connection']

const PLUGIN = 'dsh-new-api'
const ROUTE_PATH = '/dsh-new-api/api'
const STATUS_PATH = '/api/status'
const USER_SELF_PATH = '/api/user/self'
const CHECKIN_PATH = '/api/user/checkin'
const CHECKIN_FALLBACK_PATHS = ['/api/user/sign_in', '/api/user/check_in']
/* 签到余额（wallet）：部分 fork（如 ksir.fun）把签到领取的额度放在独立钱包里，
 * 与 /api/user/self 的 quota（当前余额）分开计费。先在 self 响应里找，找不到才探测
 * 下列候选接口，探测结果缓存在站点记录上（site.walletPath / site.walletProbeAt）。 */
const WALLET_PATHS = ['/api/user/wallet', '/api/user/wallet/self', '/api/user/self/wallet', '/api/user/wallet/info']
const WALLET_FIELD_NAMES = [
  'wallet_quota',
  'walletQuota',
  'wallet_balance',
  'walletBalance',
  'checkin_quota',
  'checkinQuota',
  'checkin_wallet',
  'check_in_quota',
  'signin_quota',
  'sign_in_quota',
  'quota_wallet',
  'daily_quota',
  'day_quota',
]
const WALLET_NESTED_FIELDS = ['quota', 'remaining', 'balance']
const WALLET_PROBE_TTL_MS = 24 * 60 * 60 * 1_000
const SUB2API_SETTINGS_PATH = '/api/v1/settings/public'
const SUB2API_REFRESH_PATH = '/api/v1/auth/refresh'
const SUB2API_ME_PATH = '/api/v1/auth/me'
const SUB2API_CHECKIN_PATH = '/api/v1/checkin'
const SUB2API_MAX_CLAIMS = 4
const MAX_BODY_BYTES = 256 * 1024
const SCHEDULER_TICK_MS = 60_000
const MAX_DAILY_ATTEMPTS = 3
const RETRY_GAP_MS = 15 * 60_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36'

const DEFAULT_SETTINGS = Object.freeze({
  autoCheckInEnabled: true,
  dailyTime: '09:00',
  jitterMinutes: 30,
  requestTimeoutMs: 20_000,
})

const ALREADY_RE = /(今日已签到|已签到|请勿重复签到|每天仅一次|already\s*checked|already\s*signed)/i
const DISABLED_RE = /(签到功能未启用|check-in feature is not enabled)/i
const MANUAL_RE = /(turnstile|验证码|captcha)/i

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function nowIso() {
  return new Date().toISOString()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseDailyTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ''))
  if (!match) return 9 * 60
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return 9 * 60
  return hours * 60 + minutes
}

function localMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes()
}

function hashDelay(seed, maxMinutes) {
  const limit = Math.max(0, Math.min(720, Math.floor(Number(maxMinutes) || 0)))
  if (limit <= 0) return 0
  let hash = 0
  const text = String(seed)
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash % (limit + 1)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 把一个候选值解释为签到余额（原始额度单位）。
 * 只接受有限且 >= 0 的数字或数字字符串；0 表示“支持钱包但余额为 0”，仍算命中。
 */
function walletAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}

/** 在任意对象里按候选中文字段名查找签到余额。 */
function readWalletField(source) {
  if (!isPlainObject(source)) return null
  for (const name of WALLET_FIELD_NAMES) {
    const amount = walletAmount(source[name])
    if (amount !== null) return amount
  }
  const nested = source.wallet
  if (isPlainObject(nested)) {
    for (const name of WALLET_NESTED_FIELDS) {
      const amount = walletAmount(nested[name])
      if (amount !== null) return amount
    }
    return null
  }
  return walletAmount(nested)
}

/**
 * 从 GET /api/user/self 的 data 里取签到余额。
 * 返回 { remaining } 或 null（该站点没有独立钱包）。
 */
export function extractSelfWallet(data) {
  const amount = readWalletField(data)
  return amount === null ? null : { remaining: amount }
}

/**
 * 从任意候选接口的响应体里取签到余额。
 * 接受 {success:true,...} / {ret:1,...} 包装：data 直接是数字，或 data 里带钱包字段，
 * 或顶层直接带钱包字段。错误包装（success:false）与非对象一律返回 null。
 */
export function extractWalletBody(body) {
  if (!isPlainObject(body)) return null
  if (body.success !== true && body.ret !== 1) return null
  const direct = walletAmount(body.data)
  if (direct !== null) return { remaining: direct }
  const inData = readWalletField(body.data)
  if (inData !== null) return { remaining: inData }
  const inBody = readWalletField(body)
  return inBody === null ? null : { remaining: inBody }
}

function normalizeUserId(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

function normalizeCheckInPath(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.startsWith('/') ? text : `/${text}`
}

function normalizeCookie(value) {
  let text = String(value ?? '').trim()
  if (!text) return ''
  text = text.replace(/^cookie\s*:\s*/i, '').trim()
  if (!text.includes('=') && !/[;,\s]/.test(text)) text = `session=${text}`
  return text
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/^authorization\s*:\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .trim()
}

function maskSecret(value, prefixLength = 3) {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= prefixLength + 4) return '••••'
  return `${text.slice(0, prefixLength)}••••${text.slice(-4)}`
}

function maskCookie(value) {
  if (!value) return ''
  const match = /(?:^|;\s*)session=([^;]*)/.exec(value)
  const secret = match ? match[1] : ''
  if (!secret) return '••••'
  return `session=••••${secret.length > 4 ? secret.slice(-4) : ''}`
}

function normalizeBaseUrl(value) {
  let text = String(value ?? '').trim()
  if (!text) throw new Error('请填写站点地址')
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`
  let url
  try {
    url = new URL(text)
  } catch {
    throw new Error('站点地址格式不正确')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('仅支持 http/https 站点')
  let path = url.pathname.replace(/\/+$/, '')
  path = path.replace(/\/profile$/i, '').replace(/\/panel$/i, '').replace(/\/console$/i, '')
  return `${url.origin}${path}`
}

function hostnameOf(baseUrl) {
  try {
    return new URL(baseUrl).hostname.replace(/^www\./i, '')
  } catch {
    return baseUrl
  }
}

function readDataDir() {
  const home = String(process.env.DSH_HOME || '').trim() || join(process.env.USERPROFILE || homedir(), '.dsh')
  return join(home, PLUGIN)
}

function normalizeSettings(target) {
  const settings = isPlainObject(target) ? target : {}
  settings.autoCheckInEnabled = settings.autoCheckInEnabled !== false
  if (!/^\d{1,2}:\d{2}$/.test(String(settings.dailyTime ?? ''))) settings.dailyTime = DEFAULT_SETTINGS.dailyTime
  else {
    const parts = String(settings.dailyTime).split(':')
    settings.dailyTime = `${pad2(Number(parts[0]))}:${pad2(Number(parts[1]))}`
  }
  settings.jitterMinutes = Math.max(
    0,
    Math.min(720, Math.floor(Number(settings.jitterMinutes ?? DEFAULT_SETTINGS.jitterMinutes) || 0)),
  )
  settings.requestTimeoutMs = Math.max(
    5_000,
    Math.min(120_000, Math.floor(Number(settings.requestTimeoutMs ?? DEFAULT_SETTINGS.requestTimeoutMs) || DEFAULT_SETTINGS.requestTimeoutMs)),
  )
  return settings
}

function defaultAuthMode(token, cookie) {
  if (token) return 'bearer'
  return 'cookie'
}

/* ------------------------------------------------------------------ */
/* Durable store                                                       */
/* ------------------------------------------------------------------ */

class Store {
  constructor() {
    this.dir = readDataDir()
    this.file = join(this.dir, 'sites.json')
    this.state = { version: 1, settings: normalizeSettings({ ...DEFAULT_SETTINGS }), sites: [] }
    this.writeQueue = Promise.resolve()
    this.ready = this.load()
    void this.ready.catch(() => {})
  }

  async load() {
    try {
      const text = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(text)
      if (!isPlainObject(parsed)) throw new Error('根数据必须是 JSON 对象')
      const rawSites = parsed.sites === undefined ? [] : parsed.sites
      if (!Array.isArray(rawSites)) throw new Error('sites 必须是数组')
      const sites = rawSites.map(sanitizeStoredSite)
      if (sites.some(site => site === null)) throw new Error('sites 包含无效站点记录')
      this.state = {
        version: 1,
        settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...(isPlainObject(parsed.settings) ? parsed.settings : {}) }),
        sites,
      }
    } catch (error) {
      if (error && error.code === 'ENOENT') return
      console.error(`[${PLUGIN}] 读取站点数据失败 ${this.file}:`, error.message || error)
      throw new Error('站点数据读取失败，请修复或恢复 sites.json 后重试', { cause: error })
    }
  }

  persist() {
    const snapshot = JSON.stringify(this.state, null, 2)
    const write = async () => {
      await mkdir(this.dir, { recursive: true })
      const temporary = `${this.file}.${process.pid}.tmp`
      await writeFile(temporary, snapshot, 'utf8')
      await rename(temporary, this.file)
    }
    const pending = this.writeQueue.then(write, write)
    const reported = pending.catch((error) => {
      console.error(`[${PLUGIN}] 保存站点数据失败:`, error.message || error)
      throw new Error('保存站点数据失败，请检查数据目录', { cause: error })
    })
    this.writeQueue = reported.catch(() => {})
    return reported
  }
}

function sanitizeStoredSite(raw) {
  if (!isPlainObject(raw)) return null
  let baseUrl
  try {
    baseUrl = normalizeBaseUrl(raw.baseUrl)
  } catch {
    return null
  }
  const token = normalizeToken(raw.token)
  const cookie = normalizeCookie(raw.cookie)
  const authMode = raw.authMode === 'cookie' || raw.authMode === 'bearer' ? raw.authMode : defaultAuthMode(token, cookie)
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : hostnameOf(baseUrl),
    baseUrl,
    authMode,
    token,
    cookie,
    type: raw.type === 'sub2api' ? 'sub2api' : 'newapi',
    refreshToken: normalizeToken(raw.refreshToken),
    tokenExpiresAt: typeof raw.tokenExpiresAt === 'number' ? raw.tokenExpiresAt : 0,
    userId: normalizeUserId(raw.userId),
    checkInPath: normalizeCheckInPath(raw.checkInPath),
    enabled: raw.enabled !== false,
    autoCheckIn: raw.autoCheckIn !== false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
    info: isPlainObject(raw.info) ? raw.info : null,
    last: isPlainObject(raw.last) ? raw.last : null,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
    quota: isPlainObject(raw.quota) ? raw.quota : null,
    walletPath: typeof raw.walletPath === 'string' ? raw.walletPath : '',
    walletProbeAt: typeof raw.walletProbeAt === 'string' ? raw.walletProbeAt : '',
  }
}

/* ------------------------------------------------------------------ */
/* HTTP client for one relay site                                      */
/* ------------------------------------------------------------------ */

function authHeaders(site) {
  const headers = {}
  const authMode = site.authMode === 'cookie' ? 'cookie' : 'bearer'
  if (authMode === 'bearer' && site.token) headers.authorization = `Bearer ${site.token}`
  if (authMode === 'cookie' && site.cookie) headers.cookie = site.cookie
  if (site.userId && site.type !== 'sub2api') headers['New-Api-User'] = String(site.userId)
  return headers
}

function hasCredential(site) {
  return Boolean(site.token || site.cookie || (site.type === 'sub2api' && site.refreshToken))
}

async function readBodyAsJson(response) {
  const text = await response.text()
  if (!text) return { body: null, text: '' }
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { body: { raw: text.slice(0, 2_000) }, text }
  try {
    return { body: JSON.parse(text), text }
  } catch {
    return { body: { raw: text.slice(0, 2_000) }, text }
  }
}

async function siteRequest(site, path, init = {}, settings = DEFAULT_SETTINGS) {
  const target = /^https?:\/\//i.test(path) ? path : `${site.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const controller = new AbortController()
  const timeoutMs = Math.max(5_000, Math.min(120_000, Number(settings.requestTimeoutMs) || DEFAULT_SETTINGS.requestTimeoutMs))
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const withOrigin = Boolean(init.withOrigin)
  try {
    const headers = {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'user-agent': UA,
      'cache-control': 'no-store',
      ...authHeaders(site),
      ...(init.contentType ? { 'content-type': init.contentType } : {}),
      ...(withOrigin ? { origin: site.baseUrl, referer: `${site.baseUrl}/console` } : {}),
      ...(isPlainObject(init.headers) ? init.headers : {}),
    }
    const response = await fetch(target, {
      method: init.method || 'GET',
      headers,
      body: init.body,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    })
    const { body, text } = await readBodyAsJson(response)
    return {
      status: response.status,
      ok: response.ok,
      body,
      text,
      url: target,
      headers: response.headers,
    }
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error(`请求超时（${timeoutMs}ms）`)
    const detail = (error && error.cause && error.cause.message) || (error && error.message) || String(error)
    throw new Error(`网络请求失败：${detail}`)
  } finally {
    clearTimeout(timer)
  }
}

function pickMessage(body) {
  if (!isPlainObject(body)) return ''
  const candidates = [
    body.message,
    body.msg,
    isPlainObject(body.error) ? body.error.message : '',
    isPlainObject(body.data) ? body.data.message : '',
    isPlainObject(body.data) ? body.data.msg : '',
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

function isAuthFailure(status, body) {
  if (status === 401) return true
  if (!isPlainObject(body)) return false
  if (typeof body.code === 'string' && body.code.startsWith('AUTH_')) return true
  const message = pickMessage(body)
  return /invalid access token|not logged in|unauthorized|未登录|无权进行此操作|令牌无效|凭证无效/i.test(message)
}

function looksNonJson(siteResponse) {
  const body = siteResponse.body
  if (!isPlainObject(body)) return false
  return typeof body.raw === 'string' && /^\s*</.test(body.raw)
}

function readVersion(siteResponse) {
  try {
    return siteResponse.headers.get('x-new-api-version') || ''
  } catch {
    return ''
  }
}

async function probeStatus(site, settings) {
  const response = await siteRequest({ ...site, baseUrl: site.baseUrl, token: site.token, cookie: site.cookie, userId: site.userId, authMode: site.authMode }, STATUS_PATH, { method: 'GET' }, settings)
  const body = response.body
  const data = isPlainObject(body) && isPlainObject(body.data) ? body.data : isPlainObject(body) ? body : null
  if (!isPlainObject(body) || !(body.success === true || body.ret === 1 || (data && (data.version || data.system_name)))) {
    throw new Error(`无法识别为 New API 站点：${pickMessage(body) || `HTTP ${response.status}`}`)
  }
  const version = (data && typeof data.version === 'string' ? data.version : '') || readVersion(response)
  const info = {
    systemName: data && typeof data.system_name === 'string' ? data.system_name : data && typeof data.site_name === 'string' ? data.site_name : '',
    version,
    checkinEnabled: !(data && data.checkin_enabled === false),
    checkinKnown: Boolean(data && typeof data.checkin_enabled === 'boolean'),
    turnstile: Boolean(data && data.turnstile_check === true),
    quotaPerUnit: data && typeof data.quota_per_unit === 'number' && data.quota_per_unit > 0 ? data.quota_per_unit : null,
    displayInCurrency: Boolean(data && data.display_in_currency === true),
    quotaDisplayType: data && typeof data.quota_display_type === 'string' ? data.quota_display_type : '',
    customCurrencySymbol: data && typeof data.custom_currency_symbol === 'string' ? data.custom_currency_symbol : '',
    customCurrencyExchangeRate:
      data && typeof data.custom_currency_exchange_rate === 'number' && data.custom_currency_exchange_rate > 0
        ? data.custom_currency_exchange_rate
        : null,
    usdExchangeRate: data && typeof data.usd_exchange_rate === 'number' && data.usd_exchange_rate > 0 ? data.usd_exchange_rate : null,
    legacyAuth: !/^v1\./i.test(version),
    at: nowIso(),
  }
  return { info, response, body, data }
}

async function refreshQuota(site, settings) {
  const response = await siteRequest(site, USER_SELF_PATH, { method: 'GET' }, settings)
  const body = response.body
  if (isAuthFailure(response.status, body)) {
    throw new Error(`凭据无效或已过期：${pickMessage(body) || `HTTP ${response.status}`}`)
  }
  if (looksNonJson(response)) throw new Error('站点返回了非 JSON 响应（可能被 Cloudflare/WAF 拦截）')
  const data = isPlainObject(body) && isPlainObject(body.data) ? body.data : null
  if (!data) throw new Error(pickMessage(body) || `读取额度失败（HTTP ${response.status}）`)
  if (!site.userId) {
    const id = data.id ?? data.user_id ?? data.userId
    if (id !== undefined && id !== null && String(id).trim()) site.userId = String(id).trim()
  }
  const remaining = Number(data.quota ?? 0)
  const used = Number(data.used_quota ?? data.usedQuota ?? 0)
  const perUnit = (site.info && site.info.quotaPerUnit) || (await quotaPerUnit(site, settings))
  const usd = perUnit ? Math.round((remaining / perUnit) * 100) / 100 : null
  const rate = site.info && site.info.usdExchangeRate ? site.info.usdExchangeRate : 1
  const usedUsd = perUnit ? used / perUnit : null
  const info = site.info || {}
  const isCustom = info.quotaDisplayType === 'CUSTOM'
  const customRate = typeof info.customCurrencyExchangeRate === 'number' && info.customCurrencyExchangeRate > 0 ? info.customCurrencyExchangeRate : 1
  const custom = isCustom && usd !== null ? Math.round(usd * customRate * 100) / 100 : null
  const usedCustom = isCustom && perUnit ? Math.round((used / perUnit) * customRate * 100) / 100 : null
  site.quota = {
    remaining: Number.isFinite(remaining) ? remaining : 0,
    used: Number.isFinite(used) ? used : 0,
    quotaPerUnit: perUnit,
    usd,
    cny: usd === null ? null : Math.round(usd * rate * 100) / 100,
    usedCny: usedUsd === null ? null : Math.round(usedUsd * rate * 100) / 100,
    custom,
    usedCustom,
    symbol: isCustom ? info.customCurrencySymbol || '' : '',
    currency: info.quotaDisplayType || 'USD',
    at: nowIso(),
    wallet: null,
  }
  const rates = { perUnit, rate, isCustom, customRate, info }
  try {
    site.quota.wallet = await refreshWallet(site, data, rates, settings)
  } catch {
    /* 签到余额读取失败（网络/凭据/接口变更）绝不能影响当前余额，也不能写 lastError */
    site.quota.wallet = null
  }
  return site.quota
}

/** 组装签到余额快照，换算规则与当前余额完全一致。 */
function walletSnapshot(amount, source, rates) {
  const usd = rates.perUnit ? Math.round((amount / rates.perUnit) * 100) / 100 : null
  return {
    remaining: amount,
    usd,
    cny: usd === null ? null : Math.round(usd * rates.rate * 100) / 100,
    custom: rates.isCustom && usd !== null ? Math.round(usd * rates.customRate * 100) / 100 : null,
    symbol: rates.isCustom ? rates.info.customCurrencySymbol || '' : '',
    currency: rates.info.quotaDisplayType || 'USD',
    source,
    at: nowIso(),
  }
}

/**
 * 解析站点的签到余额（wallet）。
 * 1) 先在已经取回的 /api/user/self 里找（零额外请求）；
 * 2) 命中过就沿用缓存的接口路径（每次刷新 1 个请求）；
 * 3) 从未命中时按候选接口探测一次，结果连同时间戳缓存，24h 内不再重复探测。
 * 返回钱包快照或 null；异常由调用方兜住。
 */
async function refreshWallet(site, selfData, rates, settings) {
  const fromSelf = extractSelfWallet(selfData)
  if (fromSelf) {
    site.walletPath = 'self'
    site.walletProbeAt = nowIso()
    return walletSnapshot(fromSelf.remaining, 'self', rates)
  }
  const cachedPath =
    typeof site.walletPath === 'string' && site.walletPath && site.walletPath !== 'self' ? site.walletPath : ''
  if (!cachedPath) {
    const probedAt = Date.parse(typeof site.walletProbeAt === 'string' ? site.walletProbeAt : '')
    if (typeof site.walletPath === 'string' && Number.isFinite(probedAt) && Date.now() - probedAt < WALLET_PROBE_TTL_MS) {
      return null
    }
  }
  const paths = cachedPath ? [cachedPath] : WALLET_PATHS
  for (const path of paths) {
    let response
    try {
      response = await siteRequest(site, path, { method: 'GET' }, settings)
    } catch {
      continue
    }
    if (response.status === 404 || response.status === 405) {
      if (cachedPath) {
        /* 接口被下线：清掉缓存，避免每次刷新都打一个 404 */
        site.walletPath = ''
        site.walletProbeAt = nowIso()
      }
      continue
    }
    if (response.status !== 200) continue
    const found = extractWalletBody(response.body)
    if (!found) continue
    site.walletPath = path
    site.walletProbeAt = nowIso()
    return walletSnapshot(found.remaining, path, rates)
  }
  if (!cachedPath) {
    site.walletPath = ''
    site.walletProbeAt = nowIso()
  }
  return null
}

const quotaUnitCache = new Map()

async function quotaPerUnit(site, settings) {
  const cached = quotaUnitCache.get(site.baseUrl)
  if (cached && Date.now() - cached.at < 3_600_000) return cached.value
  try {
    const { info } = await probeStatus(site, settings)
    if (info.quotaPerUnit) site.info = { ...(site.info || {}), ...info }
    quotaUnitCache.set(site.baseUrl, { at: Date.now(), value: info.quotaPerUnit })
    return info.quotaPerUnit
  } catch {
    return null
  }
}

async function getCheckinStatus(site, settings) {
  const month = localDate().slice(0, 7)
  try {
    const response = await siteRequest(site, `${CHECKIN_PATH}?month=${month}`, { method: 'GET' }, settings)
    const body = response.body
    if (isAuthFailure(response.status, body)) return { ok: false, authError: true, message: pickMessage(body) }
    if (!isPlainObject(body) || body.success !== true) return { ok: false, message: pickMessage(body) || `HTTP ${response.status}` }
    const data = isPlainObject(body.data) ? body.data : {}
    const stats = isPlainObject(data.stats) ? data.stats : {}
    return {
      ok: true,
      enabled: data.enabled !== false,
      checkedInToday: stats.checked_in_today === true,
      stats,
    }
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

async function performCheckIn(site, settings) {
  // 1. Gate on the site's advertised check-in capability (fresh probe; the
  //    status document is unauthenticated and cheap).
  let info = null
  try {
    info = (await probeStatus(site, settings)).info
    site.info = info
  } catch {
    info = site.info || null
  }
  if (info && info.checkinEnabled === false) {
    return { status: 'unsupported', message: '站点未开启签到功能', quotaAwarded: null }
  }
  if (info && info.turnstile) {
    return { status: 'manual', message: '站点启用了 Turnstile 人机验证，请在浏览器中手动签到后点“刷新”', quotaAwarded: null }
  }

  // 2. Cheap pre-check: already checked in today?
  const status = await getCheckinStatus(site, settings)
  if (status.ok && status.checkedInToday) {
    return { status: 'already', message: '今日已签到', quotaAwarded: null }
  }
  if (status.authError) {
    return { status: 'failed', authError: true, message: `认证失败：${status.message || '凭据无效'}`, quotaAwarded: null }
  }

  // 3. POST the check-in endpoint, falling back across known fork routes.
  const paths = site.checkInPath ? [site.checkInPath] : [CHECKIN_PATH, ...CHECKIN_FALLBACK_PATHS]
  let lastError = ''
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index]
    let response
    try {
      response = await siteRequest(
        site,
        path,
        { method: 'POST', withOrigin: true, contentType: 'application/json' },
        settings,
      )
    } catch (error) {
      return { status: 'failed', message: error.message, quotaAwarded: null }
    }
    const body = response.body
    const message = pickMessage(body) || (isPlainObject(body) && typeof body.raw === 'string' ? body.raw.slice(0, 200) : '') || `HTTP ${response.status}`
    if (isAuthFailure(response.status, body)) {
      return { status: 'failed', authError: true, message: `认证失败：${message || '凭据无效或已过期'}`, quotaAwarded: null }
    }
    if (looksNonJson(response)) {
      return { status: 'failed', message: '站点返回了非 JSON 响应（可能被 Cloudflare/WAF 拦截）', quotaAwarded: null }
    }
    if (response.status === 404 || (isPlainObject(body) && isPlainObject(body.error) && /Invalid URL/i.test(String(body.error.message || '')))) {
      lastError = `签到接口不存在（${path}）`
      if (site.checkInPath || index === paths.length - 1) return { status: 'failed', message: lastError, quotaAwarded: null }
      continue
    }
    if (isPlainObject(body) && body.success === true) {
      const data = body.data
      const awarded = typeof data === 'number' ? data : Number(isPlainObject(data) ? (data.quota_awarded ?? data.quota ?? 0) : 0)
      const serverDate = isPlainObject(data) && typeof data.checkin_date === 'string' ? data.checkin_date : ''
      if (!site.checkInPath) site.checkInPath = path
      return {
        status: 'success',
        message: message || '签到成功',
        quotaAwarded: Number.isFinite(awarded) ? awarded : null,
        serverDate,
      }
    }
    if (ALREADY_RE.test(message)) return { status: 'already', message, quotaAwarded: null }
    if (DISABLED_RE.test(message)) return { status: 'unsupported', message, quotaAwarded: null }
    if (MANUAL_RE.test(message) && !isPlainObject(body)) return { status: 'manual', message, quotaAwarded: null }
    return { status: 'failed', message, quotaAwarded: null }
  }
  return { status: 'failed', message: lastError || '未找到可用的签到接口', quotaAwarded: null }
}

/* ------------------------------------------------------------------ */
/* Site views and operations                                           */
/* ------------------------------------------------------------------ */

function todayStatusOf(site) {
  if (!site.enabled) return 'disabled'
  if (site.last && site.last.date === localDate()) {
    if (site.last.status === 'success') return 'success'
    if (site.last.status === 'already') return 'already'
    if (site.last.status === 'unsupported') return 'unsupported'
    if (site.last.status === 'manual') return 'manual'
    return 'failed'
  }
  return 'pending'
}

function siteView(site) {
  return {
    id: site.id,
    name: site.name,
    baseUrl: site.baseUrl,
    type: site.type,
    authMode: site.authMode,
    userId: site.userId,
    hasToken: Boolean(site.token),
    tokenMasked: maskSecret(site.token),
    hasCookie: Boolean(site.cookie),
    cookieMasked: maskCookie(site.cookie),
    enabled: site.enabled !== false,
    autoCheckIn: site.autoCheckIn !== false,
    checkInPath: site.checkInPath,
    walletPath: typeof site.walletPath === 'string' ? site.walletPath : '',
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    info: site.info ? { ...site.info } : null,
    todayStatus: todayStatusOf(site),
    lastCheckIn: site.last
      ? {
          date: site.last.date,
          status: site.last.status,
          message: site.last.message,
          at: site.last.at,
          quotaAwarded: site.last.quotaAwarded ?? null,
          attempts: site.last.attempts ?? 1,
        }
      : null,
    lastError: site.lastError ?? null,
    quota: site.quota ? { ...site.quota } : null,
  }
}

function createOperations(store) {
  const inFlight = new Map()
  let schedulerBusy = false

  function checkInIdentity(site) {
    return JSON.stringify([
      site.baseUrl,
      site.type,
      site.authMode,
      site.token,
      site.cookie,
      site.userId,
      site.checkInPath,
      site.refreshToken,
      site.tokenExpiresAt,
    ])
  }

  function settings() {
    return store.state.settings
  }

  function requireSite(id) {
    const site = store.state.sites.find((candidate) => candidate.id === id)
    if (!site) throw new Error('站点不存在')
    return site
  }

  function applyCredential(site, payload) {
    let changed = false
    if (payload.authMode === 'bearer' || payload.authMode === 'cookie') {
      if (site.authMode !== payload.authMode) {
        site.authMode = payload.authMode
        changed = true
      }
    }
    if (payload.token !== undefined) {
      const token = normalizeToken(payload.token)
      if (token && token !== site.token) {
        site.token = token
        changed = true
      }
      if (payload.clearToken === true && site.token) {
        site.token = ''
        changed = true
      }
    }
    if (payload.cookie !== undefined) {
      const cookie = normalizeCookie(payload.cookie)
      if (cookie && cookie !== site.cookie) {
        site.cookie = cookie
        changed = true
      }
      if (payload.clearCookie === true && site.cookie) {
        site.cookie = ''
        changed = true
      }
    }
    if (payload.userId !== undefined) {
      const userId = normalizeUserId(payload.userId)
      if (userId !== site.userId) {
        site.userId = userId
        changed = true
      }
    }
    if (changed) {
      site.last = null
      site.lastError = null
      site.quota = null
      /* 凭据变了，钱包能力可能也跟着变：清空缓存以便下次刷新重新探测 */
      site.walletPath = ''
      site.walletProbeAt = ''
    }
    return changed
  }

  async function recordCheckIn(site) {
    const identity = checkInIdentity(site)
    const working = structuredClone(site)
    const currentSettings = { ...settings() }
    const result = await performCheckIn(working, currentSettings)
    const date = result.serverDate || localDate()
    const previous = working.last && working.last.date === date ? working.last : null
    if (result.status === 'success' || result.status === 'already') {
      working.last = {
        date,
        status: result.status,
        message: result.message,
        at: nowIso(),
        quotaAwarded: result.quotaAwarded ?? null,
        attempts: (previous ? previous.attempts || 1 : 0) + 1,
      }
      working.lastError = null
    } else {
      working.last = {
        date,
        status: result.status,
        message: result.message,
        at: nowIso(),
        quotaAwarded: null,
        attempts: (previous ? previous.attempts || 1 : 0) + 1,
      }
      working.lastError = result.status === 'failed' ? result.message : null
    }
    working.updatedAt = nowIso()
    try {
      await refreshQuota(working, currentSettings)
    } catch (error) {
      if (result.status === 'failed') working.lastError = result.message
      else if (!working.lastError) working.lastError = `额度刷新失败：${error.message}`
    }
    const current = store.state.sites.find(candidate => candidate.id === site.id)
    if (!current || checkInIdentity(current) !== identity) {
      return { site: current || working, result, discarded: true }
    }
    for (const key of ['info', 'userId', 'checkInPath', 'last', 'lastError', 'quota', 'walletPath', 'walletProbeAt', 'updatedAt']) {
      current[key] = working[key]
    }
    return { site: current, result, discarded: false }
  }

  function runCheckIn(site) {
    const key = `${site.id}\n${checkInIdentity(site)}`
    if (inFlight.has(key)) return inFlight.get(key)
    const task = recordCheckIn(site).finally(() => inFlight.delete(key))
    inFlight.set(key, task)
    return task
  }

  async function getState() {
    await store.ready
    return {
      settings: { ...store.state.settings },
      sites: store.state.sites.map(siteView),
      serverTime: nowIso(),
    }
  }

  async function addSite(payload) {
    await store.ready
    const baseUrl = normalizeBaseUrl(payload.baseUrl)
    const token = normalizeToken(payload.token)
    const cookie = normalizeCookie(payload.cookie)
    const authMode = payload.authMode === 'cookie' || payload.authMode === 'bearer' ? payload.authMode : defaultAuthMode(token, cookie)
    if (authMode === 'bearer' && !token) throw new Error('请填写访问令牌（Bearer Token）')
    if (authMode === 'cookie' && !cookie) throw new Error('请填写 Cookie（session）')
    if (store.state.sites.some((site) => site.baseUrl === baseUrl)) throw new Error('该站点已存在')
    const site = {
      id: randomUUID(),
      name: String(payload.name ?? '').trim() || hostnameOf(baseUrl),
      baseUrl,
      authMode,
      token,
      cookie,
      type: 'newapi',
      userId: normalizeUserId(payload.userId),
      checkInPath: normalizeCheckInPath(payload.checkInPath),
      enabled: true,
      autoCheckIn: payload.autoCheckIn !== false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      info: null,
      last: null,
      lastError: null,
      quota: null,
      walletPath: '',
      walletProbeAt: '',
    }
    try {
      const { info } = await probeStatus(site, settings())
      site.info = info
      if (!String(payload.name ?? '').trim() && info.systemName) site.name = info.systemName
      if (info.checkinEnabled === false) site.lastError = '该站点未开启签到功能'
      if (info.turnstile) site.lastError = '该站点启用了 Turnstile，自动签到不可用；请先在浏览器手动签到'
    } catch (error) {
      if (!String(payload.name ?? '').trim()) site.name = hostnameOf(baseUrl)
      site.lastError = `站点检测失败：${error.message}`
    }
    try {
      await refreshQuota(site, settings())
      if (site.lastError && /测试失败/.test(site.lastError)) site.lastError = null
    } catch (error) {
      site.lastError = `凭据验证失败：${error.message}`
    }
    store.state.sites.push(site)
    await store.persist()
    return { site: siteView(site) }
  }

  async function updateSite(payload) {
    await store.ready
    const index = store.state.sites.findIndex(candidate => candidate.id === payload.id)
    if (index < 0) throw new Error('站点不存在')
    const previous = store.state.sites[index]
    const site = structuredClone(previous)
    let baseUrlChanged = false
    if (payload.name !== undefined) site.name = String(payload.name ?? '').trim() || hostnameOf(site.baseUrl)
    if (payload.baseUrl !== undefined) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl)
      if (baseUrl !== site.baseUrl) {
        baseUrlChanged = true
        site.baseUrl = baseUrl
        site.quota = null
        site.info = null
        site.walletPath = ''
        site.walletProbeAt = ''
      }
    }
    const credentialsChanged = applyCredential(site, payload)
    if (site.authMode === 'bearer' && !site.token) throw new Error('Bearer 认证需要访问令牌（Token）')
    if (site.authMode === 'cookie' && !site.cookie) throw new Error('Cookie 认证需要 session Cookie')
    if (payload.checkInPath !== undefined) site.checkInPath = normalizeCheckInPath(payload.checkInPath)
    if (payload.enabled !== undefined) site.enabled = Boolean(payload.enabled)
    if (payload.autoCheckIn !== undefined) site.autoCheckIn = Boolean(payload.autoCheckIn)
    site.updatedAt = nowIso()
    if (credentialsChanged || !site.info) {
      try {
        const { info } = await probeStatus(site, settings())
        site.info = info
      } catch (error) {
        site.lastError = `站点检测失败：${error.message}`
      }
    }
    if (site.token || site.cookie) {
      try {
        await refreshQuota(site, settings())
        site.lastError = null
      } catch (error) {
        site.lastError = `凭据验证失败：${error.message}`
      }
    }
    if (store.state.sites[index] !== previous) throw new Error('站点已被其他操作修改，请重试')
    store.state.sites[index] = site
    try {
      await store.persist()
    } catch (error) {
      if (store.state.sites[index] === site) store.state.sites[index] = previous
      throw error
    }
    if (baseUrlChanged) quotaUnitCache.delete(previous.baseUrl)
    return { site: siteView(site) }
  }

  async function removeSite(payload) {
    await store.ready
    const index = store.state.sites.findIndex((site) => site.id === payload.id)
    if (index < 0) throw new Error('站点不存在')
    store.state.sites.splice(index, 1)
    await store.persist()
    return { removed: true, id: payload.id }
  }

  async function checkInSite(payload) {
    await store.ready
    const site = requireSite(payload.id)
    if (!site.token && !site.cookie) throw new Error('该站点尚未配置凭据')
    const { site: updated, result } = await runCheckIn(site)
    await store.persist()
    return { site: siteView(updated), result }
  }

  async function checkInAll() {
    await store.ready
    const results = []
    for (const site of store.state.sites) {
      if (!site.enabled) {
        results.push({ id: site.id, name: site.name, status: 'skipped', message: '站点已停用' })
        continue
      }
      if (!site.token && !site.cookie) {
        results.push({ id: site.id, name: site.name, status: 'failed', message: '未配置凭据' })
        continue
      }
      try {
        const { result } = await runCheckIn(site)
        results.push({ id: site.id, name: site.name, status: result.status, message: result.message })
      } catch (error) {
        results.push({ id: site.id, name: site.name, status: 'failed', message: error.message })
      }
    }
    await store.persist()
    return { results, sites: store.state.sites.map(siteView) }
  }

  async function refreshSiteState(site) {
    if (!site.token && !site.cookie) throw new Error('该站点尚未配置凭据')
    try {
      const { info } = await probeStatus(site, settings())
      site.info = info
    } catch {
      /* quota may still work when /api/status is restricted */
    }
    await refreshQuota(site, settings())
    site.lastError = null
    site.updatedAt = nowIso()
  }

  async function refreshSite(payload) {
    await store.ready
    const index = store.state.sites.findIndex(candidate => candidate.id === payload.id)
    if (index < 0) throw new Error('站点不存在')
    const previous = store.state.sites[index]
    const site = structuredClone(previous)
    await refreshSiteState(site)
    if (store.state.sites[index] !== previous) throw new Error('站点已被其他操作修改，请重试')
    store.state.sites[index] = site
    try {
      await store.persist()
    } catch (error) {
      if (store.state.sites[index] === site) store.state.sites[index] = previous
      throw error
    }
    return { site: siteView(site) }
  }

  async function refreshAll() {
    await store.ready
    const previous = store.state.sites
    const sites = []
    const results = []
    for (const current of previous) {
      const site = structuredClone(current)
      try {
        await refreshSiteState(site)
        results.push({ id: site.id, name: site.name, status: 'success' })
      } catch (error) {
        site.lastError = `额度刷新失败：${error.message}`
        results.push({ id: site.id, name: site.name, status: 'failed', message: error.message })
      }
      sites.push(site)
    }
    store.state.sites = sites
    try {
      await store.persist()
    } catch (error) {
      if (store.state.sites === sites) store.state.sites = previous
      throw error
    }
    return { results, sites: sites.map(siteView) }
  }

  async function detectSiteAction(payload) {
    await store.ready
    const baseUrl = normalizeBaseUrl(payload.baseUrl)
    const token = normalizeToken(payload.token)
    const cookie = normalizeCookie(payload.cookie)
    const probe = { baseUrl, token, cookie, userId: normalizeUserId(payload.userId), authMode: payload.authMode === 'cookie' ? 'cookie' : defaultAuthMode(token, cookie) }
    try {
      const { info } = await probeStatus(probe, settings())
      return { detected: { baseUrl, ...info } }
    } catch (error) {
      return { detected: null, error: error.message }
    }
  }

  async function saveSettings(payload) {
    await store.ready
    const patch = isPlainObject(payload.settings) ? payload.settings : isPlainObject(payload) ? payload : {}
    const current = store.state.settings
    const next = { ...current }
    if (patch.autoCheckInEnabled !== undefined) next.autoCheckInEnabled = Boolean(patch.autoCheckInEnabled)
    if (patch.dailyTime !== undefined) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(patch.dailyTime ?? ''))
      if (!match) throw new Error('签到时间格式应为 HH:MM')
      const hours = Number(match[1])
      const minutes = Number(match[2])
      if (hours > 23 || minutes > 59) throw new Error('签到时间超出范围')
      next.dailyTime = `${pad2(hours)}:${pad2(minutes)}`
    }
    if (patch.jitterMinutes !== undefined) {
      const value = Number(patch.jitterMinutes)
      if (!Number.isFinite(value)) throw new Error('随机延迟无效')
      next.jitterMinutes = Math.max(0, Math.min(720, Math.round(value)))
    }
    if (patch.requestTimeoutMs !== undefined) {
      const value = Number(patch.requestTimeoutMs)
      if (Number.isFinite(value)) next.requestTimeoutMs = Math.max(5_000, Math.min(120_000, Math.round(value)))
    }
    store.state.settings = next
    try {
      await store.persist()
    } catch (error) {
      if (store.state.settings === next) store.state.settings = current
      throw error
    }
    return { settings: { ...next } }
  }

  async function schedulerTick() {
    if (schedulerBusy) return
    schedulerBusy = true
    try {
      await store.ready
      const current = store.state.settings
      if (!current.autoCheckInEnabled) return
      const today = localDate()
      const currentMinutes = localMinutes()
      const base = parseDailyTime(current.dailyTime)
      const due = []
      for (const site of store.state.sites) {
        if (!site.enabled || site.autoCheckIn === false) continue
        if (!site.token && !site.cookie) continue
        if (site.info && (site.info.checkinEnabled === false || site.info.turnstile)) continue
        const last = site.last
        if (last && last.date === today && last.status !== 'failed') continue
        if (last && last.date === today && last.status === 'failed') {
          const attempts = last.attempts || 1
          if (attempts >= MAX_DAILY_ATTEMPTS) continue
          const elapsed = Date.now() - Date.parse(last.at)
          if (!Number.isFinite(elapsed) || elapsed < RETRY_GAP_MS) continue
        }
        const target = Math.min(1_439, base + hashDelay(`${today}|${site.id}`, current.jitterMinutes))
        if (currentMinutes >= target) due.push(site)
      }
      if (!due.length) return
      for (const site of due) {
        try {
          const { result } = await runCheckIn(site)
          console.log(`[${PLUGIN}] 自动签到 ${site.name}: ${result.status} — ${result.message}`)
        } catch (error) {
          console.error(`[${PLUGIN}] 自动签到 ${site.name} 出错:`, error.message || error)
        }
      }
      await store.persist()
    } catch (error) {
      console.error(`[${PLUGIN}] 调度器出错:`, error.message || error)
    } finally {
      schedulerBusy = false
    }
  }

  async function dispatch(action, payload) {
    const input = isPlainObject(payload) ? payload : {}
    switch (action) {
      case 'getState':
        return getState()
      case 'addSite':
        return addSite(input)
      case 'updateSite':
        return updateSite(input)
      case 'removeSite':
        return removeSite(input)
      case 'checkInSite':
        return checkInSite(input)
      case 'checkInAll':
        return checkInAll()
      case 'refreshSite':
        return refreshSite(input)
      case 'refreshAll':
        return refreshAll()
      case 'detectSite':
        return detectSiteAction(input)
      case 'saveSettings':
        return saveSettings(input)
      default:
        throw new Error(`未知操作：${action || '(empty)'}`)
    }
  }

  return { dispatch, schedulerTick, getState }
}

/* ------------------------------------------------------------------ */
/* Web route                                                           */
/* ------------------------------------------------------------------ */

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function sendJson(response, status, value) {
  if (response.headersSent) return
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

function routeRejection(ctx, request) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return 403
  return connection.requestRejection({ headers: request.headers })
}

function createRouteHandler(ctx, operations) {
  return async function handle(request, response) {
    try {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'Method Not Allowed' })
        return
      }
      if (String(request.headers['x-dsh-new-api'] ?? '') !== '1') {
        sendJson(response, 403, { ok: false, error: 'Forbidden' })
        return
      }
      const rejection = routeRejection(ctx, request)
      if (rejection) {
        sendJson(response, rejection, { ok: false, error: rejection === 401 ? 'Unauthorized' : 'Forbidden' })
        return
      }
      const raw = await readRequestBody(request)
      let parsed = {}
      if (raw) {
        try {
          parsed = JSON.parse(raw)
        } catch {
          sendJson(response, 400, { ok: false, error: '请求体不是合法 JSON' })
          return
        }
      }
      const action = isPlainObject(parsed) && typeof parsed.action === 'string' ? parsed.action : ''
      const data = await operations.dispatch(action, parsed ? parsed.payload : null)
      sendJson(response, 200, { ok: true, data })
    } catch (error) {
      sendJson(response, 200, { ok: false, error: error && error.message ? error.message : String(error) })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Agent tool                                                          */
/* ------------------------------------------------------------------ */

function registerAgentTool(ctx, operations) {
  const tools = ctx.get('tools')
  if (!tools) return
  ctx.effect(
    () =>
      tools.register({
        name: 'newapi_sites',
        description:
          '管理 New API / One API 公益站（如 https://api.ark717.com）：查看站点列表、额度（当前余额 + 签到余额 wallet）、认证方式与今日签到状态；添加/修改/删除站点；立即签到；查看或修改每日自动签到设置。签到余额（quota.wallet）只在站点支持独立钱包时出现，自动探测并在 quota.wallet.source 里给出处。凭据由插件保存，工具结果只返回脱敏值。新版 New API 站点用 Bearer 访问令牌，旧版用 session Cookie + 用户 ID。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'add', 'update', 'remove', 'check_in', 'check_all', 'refresh', 'settings', 'save_settings'],
              description:
                'list=站点与设置; add=添加站点; update=修改站点; remove=删除站点; check_in=签到单个站点; check_all=全部签到; refresh=刷新单个站点额度; settings=读取设置; save_settings=保存设置',
            },
            id: { type: 'string', description: '站点 id（update/remove/check_in/refresh 需要）' },
            name: { type: 'string', description: '站点显示名称（add/update）' },
            baseUrl: { type: 'string', description: '站点根地址，例如 https://api.ark717.com（add 需要）' },
            authMode: {
              type: 'string',
              enum: ['bearer', 'cookie'],
              description: '认证方式：bearer=新版 New API 访问令牌（推荐）；cookie=旧版 session Cookie + 用户 ID',
            },
            token: { type: 'string', description: 'Bearer 访问令牌 / PAT（authMode=bearer 时必填；update 留空表示不修改）' },
            cookie: { type: 'string', description: '浏览器 Cookie，需包含 session=...（authMode=cookie 时必填；update 留空表示不修改）' },
            userId: { type: 'string', description: '用户 ID（旧版站点必填，用于 New-Api-User 请求头；新版可留空自动获取）' },
            checkInPath: { type: 'string', description: '自定义签到接口路径，默认自动尝试 /api/user/checkin 与 /api/user/sign_in' },
            enabled: { type: 'boolean', description: '站点是否启用（update）' },
            autoCheckIn: { type: 'boolean', description: '站点是否参与每日自动签到（add/update）' },
            settings: {
              type: 'object',
              additionalProperties: true,
              description: 'save_settings 使用：{autoCheckInEnabled, dailyTime:"HH:MM", jitterMinutes}',
            },
          },
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render(args, value) {
            return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
          },
        },
        async execute(args) {
          const input = isPlainObject(args) ? args : {}
          switch (input.action) {
            case 'list':
              return operations.getState()
            case 'settings':
              return operations.dispatch('getState', null).then((state) => ({ settings: state.settings }))
            case 'add':
              return operations.dispatch('addSite', input)
            case 'update':
              return operations.dispatch('updateSite', input)
            case 'remove':
              return operations.dispatch('removeSite', input)
            case 'check_in':
              return operations.dispatch('checkInSite', input)
            case 'check_all':
              return operations.dispatch('checkInAll', null)
            case 'refresh':
              return operations.dispatch('refreshSite', input)
            case 'save_settings':
              return operations.dispatch('saveSettings', input)
            default:
              throw new Error(`未知 action：${String(input.action)}`)
          }
        },
      }),
    'dsh-new-api: agent tool',
  )
}

/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  const store = new Store()
  const operations = createOperations(store)

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler: createRouteHandler(ctx, operations) }),
    'dsh-new-api: web route',
  )

  ctx.effect(() => ctx.timer.interval(() => { void operations.schedulerTick() }, SCHEDULER_TICK_MS), 'dsh-new-api: scheduler')
  ctx.effect(() => ctx.timer.timeout(() => { void operations.schedulerTick() }, 8_000), 'dsh-new-api: scheduler warm-up')

  registerAgentTool(ctx, operations)
}
