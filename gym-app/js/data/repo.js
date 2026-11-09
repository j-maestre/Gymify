// Única capa de acceso a datos. Dos modos:
// - local: sin sesión, todo en IndexedDB (Dexie) en este dispositivo.
// - cloud: con sesión, Firestore (con caché sin conexión) vía cloud.js.
// Las vistas solo usan getData() y las funciones exportadas aquí.
import { db } from './db.js'
import { computeMarks, makeBwAt } from './stats.js'
import { SEED_EXERCISES, rankKey } from './seed.js'

export const toDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const today = () => toDay(new Date())

const FLAG = 'gymlog.signedIn' // recuerda que había sesión para no mostrar datos locales al arrancar
const flag = (v) => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG) } catch { /* sin almacenamiento */ } }
const hadSession = () => { try { return !!localStorage.getItem(FLAG) } catch { return false } }

let cloud = null // módulo cloud.js, cargado al iniciar
let mode = 'local'
let uid = null
let raw = { exercises: [], sets: [], bodyweight: [], sessions: [] }

// status: 'local' (sin sesión) · 'loading' · 'cloud' (con sesión) · user: {uid, email, name, photo}
const account = { status: hadSession() ? 'loading' : 'local', user: null, profile: {}, friendships: [], available: false }

let cache = { exercises: [], exMap: new Map(), sets: [], bw: [], bwAt: () => 0, sessions: new Map(), account }
const subs = new Set()
export const getData = () => cache
export const subscribe = (fn) => subs.add(fn)
const notify = () => subs.forEach((fn) => fn())

// Construye los datos derivados a partir de `raw`
function build() {
  const exercises = [...raw.exercises].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const exMap = new Map(exercises.map((e) => [e.id, e]))
  const bw = [...raw.bodyweight].sort((a, b) => a.date.localeCompare(b.date))
  const bwAt = makeBwAt(bw)
  // Carga efectiva de cada serie: peso + peso corporal si el ejercicio es de peso propio
  const sets = [...raw.sets].sort((a, b) => a.ts - b.ts).map((s) => {
    const b = bwAt(s.date)
    const own = exMap.get(s.exerciseId)?.bodyweight ? b : 0
    return { ...s, bw: b, load: (s.weight || 0) + own }
  })
  cache = { exercises, exMap, sets, bw, bwAt, sessions: new Map(raw.sessions.map((s) => [s.date, s])), account }
  notify()
  if (mode === 'cloud') scheduleMarks()
}

async function readLocal() {
  const [exercises, sets, bodyweight, sessions] = await Promise.all([
    db.exercises.toArray(), db.sets.toArray(), db.bodyweight.toArray(), db.sessions.toArray(),
  ])
  return { exercises, sets, bodyweight, sessions }
}

export async function reload() {
  if (mode === 'local') raw = await readLocal()
  build()
}

// ---- Escrituras ----
const strip = ({ id, ...o }) => o // eslint-disable-line no-unused-vars
const localWrite = async (p) => { const r = await p; await reload(); return r }

// En la nube: se aplica al momento en memoria y se sube sin esperar (funciona sin conexión)
function cput(col, id, data) {
  const list = raw[col].filter((x) => x.id !== id)
  raw = { ...raw, [col]: [...list, { ...data, id }] }
  build()
  cloud.put(uid, col, id, data).catch(fail)
  return id
}
function cdel(col, id) {
  raw = { ...raw, [col]: raw[col].filter((x) => x.id !== id) }
  build()
  cloud.del(uid, col, id).catch(fail)
}
const fail = (e) => { console.error(e); alert('No se pudo guardar en la nube: ' + e.message) }
const find = (col, id) => raw[col].find((x) => x.id === id)

// ---- Series ----
export const addSet = ({ exerciseId, reps, weight, warmup = false, date = today() }) => {
  const s = { exerciseId, reps, weight, warmup, date, ts: Date.now() }
  return mode === 'cloud' ? cput('sets', cloud.newId(uid, 'sets'), s) : localWrite(db.sets.add(s))
}
export const updateSet = (id, patch) =>
  mode === 'cloud' ? cput('sets', id, { ...strip(find('sets', id)), ...patch }) : localWrite(db.sets.update(id, patch))
export const deleteSet = (id) => (mode === 'cloud' ? cdel('sets', id) : localWrite(db.sets.delete(id)))

// ---- Sesión del día (ejercicios planificados) ----
export const setSessionExercises = async (date, exerciseIds, routineId) => {
  const prev = mode === 'cloud' ? find('sessions', date) : await db.sessions.get(date)
  const s = { date, routineId: routineId ?? prev?.routineId ?? null, exerciseIds }
  return mode === 'cloud' ? cput('sessions', date, s) : localWrite(db.sessions.put(s))
}

// ---- Ejercicios ----
export const addExercise = (e) =>
  mode === 'cloud' ? cput('exercises', cloud.newId(uid, 'exercises'), { key: null, ...e }) : localWrite(db.exercises.add(e))
export const updateExercise = (id, e) =>
  mode === 'cloud' ? cput('exercises', id, { ...strip(find('exercises', id)), ...e }) : localWrite(db.exercises.update(id, e))
export const deleteExercise = (id) => {
  if (mode === 'local') {
    return localWrite(db.transaction('rw', db.exercises, db.sets, async () => {
      await db.sets.where('exerciseId').equals(id).delete()
      await db.exercises.delete(id)
    }))
  }
  const gone = raw.sets.filter((s) => s.exerciseId === id)
  raw = { ...raw, sets: raw.sets.filter((s) => s.exerciseId !== id), exercises: raw.exercises.filter((e) => e.id !== id) }
  build()
  cloud.batch(uid, [...gone.map((s) => ({ col: 'sets', id: s.id, data: null })), { col: 'exercises', id, data: null }]).catch(fail)
}

// ---- Peso corporal ----
export const saveBodyweight = (date, kg) =>
  mode === 'cloud' ? cput('bodyweight', date, { date, kg }) : localWrite(db.bodyweight.put({ date, kg }))
export const deleteBodyweight = (date) => (mode === 'cloud' ? cdel('bodyweight', date) : localWrite(db.bodyweight.delete(date)))

// ---- Copia de seguridad ----
const TABLES = ['exercises', 'sets', 'sessions', 'bodyweight']

export const exportData = async () => {
  const src = mode === 'cloud' ? raw : await readLocal()
  const out = { version: 3, exportedAt: new Date().toISOString() }
  for (const t of TABLES) out[t] = src[t]
  return out
}

export const importData = async (data) => {
  if (!data?.exercises || !data?.sets) throw new Error('Archivo no válido')
  if (mode === 'local') {
    return localWrite(db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
      for (const t of TABLES) {
        await db.table(t).clear()
        if (data[t]) await db.table(t).bulkAdd(data[t])
      }
    }))
  }
  await cloud.batch(uid, [
    ...TABLES.flatMap((t) => raw[t].map((x) => ({ col: t, id: x.id, data: null }))),
    ...toCloudOps(data),
  ])
}

// Convierte datos locales/exportados (ids numéricos) a operaciones para la nube
function toCloudOps(d) {
  return [
    ...(d.exercises || []).map((e) => ({ col: 'exercises', id: String(e.id), data: { ...strip(e), key: rankKey(e) } })),
    ...(d.sets || []).map((s) => ({ col: 'sets', id: String(s.id), data: { ...strip(s), exerciseId: String(s.exerciseId) } })),
    ...(d.bodyweight || []).map((b) => ({ col: 'bodyweight', id: b.date, data: { date: b.date, kg: b.kg } })),
    ...(d.sessions || []).map((s) => ({ col: 'sessions', id: s.date,
      data: { date: s.date, routineId: null, exerciseIds: (s.exerciseIds || []).map(String) } })),
  ]
}

// ============ Cuenta (Firebase) ============
export async function initAccount() {
  try {
    cloud = await import('./cloud.js')
    account.available = true
  } catch (e) {
    console.warn('Firebase no disponible (¿sin conexión?)', e)
    account.status = 'local'
    return reload()
  }
  let unFriends = null
  cloud.onUser(async (u) => {
    unFriends?.()
    if (!u) {
      cloud.stopSync()
      flag(false)
      Object.assign(account, { status: 'local', user: null, profile: {}, friendships: [] })
      mode = 'local'
      uid = null
      published = null
      return reload()
    }
    flag(true)
    uid = u.uid
    Object.assign(account, {
      status: 'loading',
      user: { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL },
    })
    notify()
    await prepareCloud()
    mode = 'cloud'
    raw = { exercises: [], sets: [], bodyweight: [], sessions: [] }
    cloud.startSync(uid,
      (col, docs) => { raw = { ...raw, [col]: docs }; account.status = 'cloud'; build() },
      (profile) => { account.profile = profile; notify() })
    unFriends = cloud.watchFriendships(uid, (list) => { account.friendships = list; notify() })
  })
  if (account.status === 'local') return reload()
}

// Primera vez en la nube: subir lo que hay en el dispositivo o crear los ejercicios predefinidos
async function prepareCloud() {
  let has
  try { has = await cloud.hasCloudData(uid) } catch { return } // sin conexión: se comprobará la próxima vez
  if (has) return
  const local = await readLocal()
  const hasLocal = local.sets.length > 0 || local.bodyweight.length > 0
  if (hasLocal && confirm('¿Subir a tu cuenta los entrenamientos guardados en este dispositivo?')) {
    await cloud.batch(uid, toCloudOps(local))
    await db.delete() // ya están en la nube; el dispositivo vuelve a empezar limpio
    await db.open()
  } else {
    await cloud.batch(uid, SEED_EXERCISES.map((e) => ({ col: 'exercises', id: cloud.newId(uid, 'exercises'), data: e })))
  }
}

const need = () => { if (!cloud) throw new Error('Sin conexión con el servidor. Inténtalo con internet.') }
export const signInGoogle = () => { need(); return cloud.signInGoogle() }
export const signInEmail = (e, p) => { need(); return cloud.signInEmail(e, p) }
export const signUpEmail = (e, p) => { need(); return cloud.signUpEmail(e, p) }
export const resetPassword = (e) => { need(); return cloud.resetPassword(e) }
export const signOut = () => cloud?.signOut()

export async function saveProfile(data) {
  need()
  await cloud.saveProfile(uid, data, account.user?.photo)
  account.profile = { ...account.profile, ...data }
  await publishMarks(true) // el alias va en las marcas
}

// ---- Amigos ----
export const searchProfiles = (q) => { need(); return cloud.searchProfiles(q) }
export const getProfile = (u) => cloud.getProfile(u)
export const requestFriend = (other) => cloud.requestFriend(uid, other)
export const acceptFriend = (id) => cloud.acceptFriend(id)
export const removeFriend = (id) => cloud.removeFriend(id)
export const friendIds = () => account.friendships
  .filter((f) => f.status === 'accepted').map((f) => f.users.find((u) => u !== uid))

// ---- Marcas públicas y rankings ----
let published = null // Map key → marca ya subida
let marksTimer = null
function scheduleMarks() {
  clearTimeout(marksTimer)
  marksTimer = setTimeout(() => publishMarks().catch((e) => console.warn('marcas', e)), 3000)
}

const SAME = ['e1rm', 'maxLoad', 'total', 'e1rmRel', 'maxLoadRel', 'totalRel', 'bw', 'alias', 'photo', 'sex']
async function publishMarks(force = false) {
  const alias = account.profile.alias
  if (mode !== 'cloud' || !alias) return
  if (!published) published = await cloud.myMarkKeys(uid)
  const extra = { alias, photo: account.user?.photo || null, sex: account.profile.sex || null }
  const next = computeMarks(cache.sets, cache.exMap, rankKey, cache.bw.at(-1)?.kg || 0)
  for (const m of next.values()) Object.assign(m, extra)
  const changed = [...next.values()].filter((m) => force || SAME.some((k) => published.get(m.key)?.[k] !== m[k]))
  const removed = [...published.keys()].filter((k) => !next.has(k))
  if (!changed.length && !removed.length) return
  await cloud.writeMarks(uid, changed, removed)
  published = next
}

// metric: 'e1rm' | 'maxLoad' | 'total' · rel: relativo al peso corporal · scope: 'friends' | 'global'
export async function getRanking({ key, metric, rel, scope }) {
  need()
  await publishMarks().catch(() => {})
  const field = rel ? `${metric}Rel` : metric
  const list = scope === 'global'
    ? await cloud.globalMarks(key)
    : await cloud.marksOf([uid, ...friendIds()], key)
  return list
    .filter((m) => m[field] > 0)
    .map((m) => ({ uid: m.uid, alias: m.alias, photo: m.photo, value: m[field], me: m.uid === uid }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50)
}
