// Adaptador de Firebase (Auth + Firestore). Solo lo usa repo.js.
// Se carga con import() dinámico: si no hay conexión la primera vez, la app sigue en modo local.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, getDocsFromServer, query, where, limit,
  writeBatch, runTransaction, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { FIREBASE_CONFIG } from '../config.js'

const app = initializeApp(FIREBASE_CONFIG)
const auth = getAuth(app)
auth.languageCode = 'es'
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })

// ---- Autenticación ----
export const onUser = (fn) => onAuthStateChanged(auth, fn)

export async function signInGoogle() {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    // En algunos móviles / apps instaladas el popup está bloqueado: se usa redirección
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
      return signInWithRedirect(auth, provider)
    }
    throw e
  }
}
export const signInEmail = (email, pass) => signInWithEmailAndPassword(auth, email, pass)
export const signUpEmail = (email, pass) => createUserWithEmailAndPassword(auth, email, pass)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)
export const signOut = () => fbSignOut(auth)

// ---- Datos privados del usuario: users/{uid}/{colección}/{id} ----
const COLS = ['exercises', 'sets', 'bodyweight', 'sessions']
let unsubs = []

// onData(colección, docs[]) cada vez que cambia algo (incluye escrituras locales aún sin subir)
export function startSync(uid, onData, onProfile) {
  stopSync()
  for (const c of COLS) {
    unsubs.push(onSnapshot(collection(fs, 'users', uid, c), (snap) =>
      onData(c, snap.docs.map((d) => ({ ...d.data(), id: d.id })))))
  }
  unsubs.push(onSnapshot(doc(fs, 'users', uid), (d) => onProfile(d.data() || {})))
}
export function stopSync() {
  unsubs.forEach((u) => u())
  unsubs = []
}

const userDoc = (uid, col, id) => doc(fs, 'users', uid, col, String(id))
export const newId = (uid, col) => doc(collection(fs, 'users', uid, col)).id
// Las escrituras no se esperan: con caché local se aplican al instante y se suben cuando hay red
export const put = (uid, col, id, data) => setDoc(userDoc(uid, col, id), data)
export const del = (uid, col, id) => deleteDoc(userDoc(uid, col, id))

// ops: [{ col, id, data }] (data null = borrar). Se trocea en lotes de 450.
export async function batch(uid, ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(fs)
    for (const { col, id, data } of ops.slice(i, i + 450)) {
      if (data) b.set(userDoc(uid, col, id), data)
      else b.delete(userDoc(uid, col, id))
    }
    await b.commit()
  }
}

// ¿Tiene ya datos en la nube? (consulta al servidor)
export async function hasCloudData(uid) {
  const snap = await getDocsFromServer(query(collection(fs, 'users', uid, 'exercises'), limit(1)))
  return !snap.empty
}

// ---- Perfil ----
// Privado: users/{uid} {alias, sex, birthDate, height}
// Público: profiles/{uid} {alias, aliasLower, photo, sex} · Alias únicos: aliases/{aliasLower} {uid}
export async function saveProfile(uid, data, photo) {
  const alias = data.alias.trim()
  const lower = alias.toLowerCase()
  await runTransaction(fs, async (tx) => {
    const privRef = doc(fs, 'users', uid)
    const prev = (await tx.get(privRef)).data() || {}
    const aliasRef = doc(fs, 'aliases', lower)
    const taken = await tx.get(aliasRef)
    if (taken.exists() && taken.data().uid !== uid) throw new Error('Ese alias ya está cogido')
    const prevLower = prev.alias?.toLowerCase()
    if (prevLower && prevLower !== lower) tx.delete(doc(fs, 'aliases', prevLower))
    tx.set(aliasRef, { uid })
    tx.set(privRef, { ...data, alias })
    tx.set(doc(fs, 'profiles', uid), { alias, aliasLower: lower, photo: photo || null, sex: data.sex || null, updatedAt: serverTimestamp() })
  })
}

export async function searchProfiles(text) {
  const q = text.trim().toLowerCase()
  if (!q) return []
  const snap = await getDocs(query(collection(fs, 'profiles'),
    where('aliasLower', '>=', q), where('aliasLower', '<=', q + ''), limit(10)))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

const profileCache = new Map()
export async function getProfile(uid) {
  if (!profileCache.has(uid)) {
    const d = await getDoc(doc(fs, 'profiles', uid))
    profileCache.set(uid, d.exists() ? { uid, ...d.data() } : { uid, alias: '¿?' })
  }
  return profileCache.get(uid)
}

// ---- Amigos: friendships/{uidA_uidB} {users:[a,b] ordenados, from, to, status} ----
const pairId = (a, b) => [a, b].sort().join('_')

export const watchFriendships = (uid, fn) =>
  onSnapshot(query(collection(fs, 'friendships'), where('users', 'array-contains', uid)), (snap) =>
    fn(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))

export async function requestFriend(me, other) {
  const ref = doc(fs, 'friendships', pairId(me, other))
  const cur = await getDoc(ref)
  if (cur.exists()) {
    const f = cur.data()
    // Si el otro ya me la había enviado, la acepto
    if (f.status === 'pending' && f.to === me) return updateDoc(ref, { status: 'accepted' })
    return
  }
  return setDoc(ref, { users: [me, other].sort(), from: me, to: other, status: 'pending', createdAt: serverTimestamp() })
}
export const acceptFriend = (id) => updateDoc(doc(fs, 'friendships', id), { status: 'accepted' })
export const removeFriend = (id) => deleteDoc(doc(fs, 'friendships', id))

// ---- Marcas públicas para rankings: marks/{uid}_{key} ----
export async function myMarkKeys(uid) {
  const snap = await getDocs(query(collection(fs, 'marks'), where('uid', '==', uid)))
  return new Map(snap.docs.map((d) => [d.data().key, d.data()]))
}
export async function writeMarks(uid, changed, removed) {
  const b = writeBatch(fs)
  for (const m of changed) b.set(doc(fs, 'marks', `${uid}_${m.key}`), { ...m, uid, updatedAt: serverTimestamp() })
  for (const key of removed) b.delete(doc(fs, 'marks', `${uid}_${key}`))
  await b.commit()
}

export async function globalMarks(key) {
  const snap = await getDocs(query(collection(fs, 'marks'), where('key', '==', key)))
  return snap.docs.map((d) => d.data())
}
export async function marksOf(uids, key) {
  const docs = await Promise.all(uids.map((u) => getDoc(doc(fs, 'marks', `${u}_${key}`))))
  return docs.filter((d) => d.exists()).map((d) => d.data())
}
