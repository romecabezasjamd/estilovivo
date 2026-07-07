const DB_NAME = 'estilovivo_sync'
const DB_VERSION = 1
const STORE_NAME = 'state'

let memoryCache: Record<string, string> = {}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        try { req.result.createObjectStore(STORE_NAME) } catch {}
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch {}
}

function getTimestamp(): number {
  return Date.now()
}

function parseValue(raw: string | null): { value: any; ts: number } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'ts' in parsed && 'value' in parsed) {
      return parsed as { value: any; ts: number }
    }
    return { value: parsed, ts: 0 }
  } catch {
    return { value: raw, ts: 0 }
  }
}

export async function syncGet<T = any>(key: string): Promise<T | null> {
  const lsRaw = lsGet(key)
  const idbRaw = await idbGet(key)
  const memRaw = memoryCache[key] || null

  const ls = parseValue(lsRaw)
  const idb = parseValue(idbRaw)
  const mem = parseValue(memRaw)

  const candidates: { value: any; ts: number; source: string }[] = []
  if (ls) candidates.push({ ...ls, source: 'ls' })
  if (idb) candidates.push({ ...idb, source: 'idb' })
  if (mem) candidates.push({ ...mem, source: 'mem' })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.ts - a.ts)
  return candidates[0].value as T
}

export async function syncSet(key: string, value: any): Promise<void> {
  const wrapped = JSON.stringify({ value, ts: getTimestamp() })
  lsSet(key, wrapped)
  memoryCache[key] = wrapped
  await idbSet(key, wrapped)
}

export async function syncRemove(key: string): Promise<void> {
  try { localStorage.removeItem(key) } catch {}
  delete memoryCache[key]
  const db = await openDB()
  if (!db) return
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
  } catch {}
}

export async function syncGetAll<T = any>(prefix: string): Promise<Record<string, T>> {
  const result: Record<string, T> = {}
  const lsKeys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) lsKeys.push(k)
    }
  } catch {}

  for (const k of lsKeys) {
    const v = await syncGet<T>(k)
    if (v !== null) result[k] = v
  }
  return result
}

export async function syncMerge<T extends Record<string, any>>(key: string, partial: T): Promise<T> {
  const existing = await syncGet<Record<string, any>>(key) || {}
  const merged = { ...existing, ...partial }
  await syncSet(key, merged)
  return merged as T
}

export function syncClearMemoryCache(): void {
  memoryCache = {}
}

export const SYNC_KEYS = {
  USER: 'ev_sync_user',
  GARMENTS: 'ev_sync_garments',
  LOOKS: 'ev_sync_looks',
  PLANNER: 'ev_sync_planner',
  TRIPS: 'ev_sync_trips',
  THEME: 'ev_sync_theme',
  SETTINGS: 'ev_sync_settings',
} as const

const BODY_PHOTO_KEY = 'tryon_body_photo'

export async function saveBodyPhoto(dataUrl: string): Promise<void> {
  await idbSet(BODY_PHOTO_KEY, dataUrl)
}

export async function loadBodyPhoto(): Promise<string | null> {
  return idbGet(BODY_PHOTO_KEY)
}

export async function clearBodyPhoto(): Promise<void> {
  await idbSet(BODY_PHOTO_KEY, '')
}
