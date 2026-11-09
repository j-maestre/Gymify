// Cálculos puros. Cada serie trae `load` = peso + peso corporal (si es ejercicio de peso propio).
export const load = (s) => s.load ?? s.weight ?? 0
export const volume = (s) => s.reps * load(s)

// 1RM estimado (Epley)
export const e1rm = (s) => (s.reps <= 1 ? load(s) : load(s) * (1 + s.reps / 30))
export const round1 = (n) => Math.round(n * 10) / 10

// Peso corporal vigente en una fecha (último registro anterior; si no hay, el primero)
export function makeBwAt(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return (date) => {
    let kg = sorted[0]?.kg ?? 0
    for (const e of sorted) { if (e.date <= date) kg = e.kg; else break }
    return kg
  }
}

export function totals(sets) {
  return sets.reduce(
    (a, s) => ({ sets: a.sets + 1, reps: a.reps + s.reps, volume: a.volume + volume(s) }),
    { sets: 0, reps: 0, volume: 0 },
  )
}

export function groupBy(arr, keyFn) {
  const m = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return m
}

// ---- Récords ----
export const REP_MAXES = [1, 3, 5, 8, 10]

// Recorre las series en orden cronológico (sin calentamientos) y detecta récords.
export function computePRs(sets) {
  const byEx = new Map()
  const events = []
  for (const s of sets) {
    if (s.warmup) continue
    let r = byEx.get(s.exerciseId)
    if (!r) {
      r = { exerciseId: s.exerciseId, maxLoad: s, best: s, maxReps: s, repMax: {} }
      byEx.set(s.exerciseId, r)
      updRepMax(r, s)
      continue // la primera serie de un ejercicio no cuenta como PR
    }
    const types = []
    if (s.load > r.maxLoad.load) { types.push('Peso máx.'); r.maxLoad = s }
    if (e1rm(s) > e1rm(r.best)) { types.push('1RM'); r.best = s }
    if (s.load === r.maxReps.load && s.reps > r.maxReps.reps) types.push('Repes')
    if (s.reps > r.maxReps.reps || (s.reps === r.maxReps.reps && s.load > r.maxReps.load)) r.maxReps = s
    for (const n of updRepMax(r, s)) if (!types.length) types.push(`${n}RM`)
    if (types.length) events.push({ set: s, types })
  }
  return { byEx, events, prIds: new Set(events.map((e) => e.set.id)) }
}

function updRepMax(r, s) {
  const improved = []
  for (const n of REP_MAXES) {
    if (s.reps >= n && s.load > 0 && (!r.repMax[n] || s.load > r.repMax[n].load)) {
      if (r.repMax[n]) improved.push(n)
      r.repMax[n] = s
    }
  }
  return improved
}

// ---- Marcas públicas para rankings (por ejercicio predefinido) ----
// Absolutas en kg y relativas (÷ peso corporal de la fecha de cada serie). Calentamientos solo suman al total.
export function computeMarks(sets, exMap, keyOf, currentBw) {
  const out = new Map()
  for (const s of sets) {
    const key = keyOf(exMap.get(s.exerciseId))
    if (!key) continue
    let m = out.get(key)
    if (!m) out.set(key, (m = { key, e1rm: 0, maxLoad: 0, total: 0, e1rmRel: 0, maxLoadRel: 0, totalRel: 0 }))
    m.total += volume(s)
    if (s.bw) m.totalRel += volume(s) / s.bw
    if (s.warmup) continue
    m.e1rm = Math.max(m.e1rm, e1rm(s))
    m.maxLoad = Math.max(m.maxLoad, load(s))
    if (s.bw) {
      m.e1rmRel = Math.max(m.e1rmRel, e1rm(s) / s.bw)
      m.maxLoadRel = Math.max(m.maxLoadRel, load(s) / s.bw)
    }
  }
  const r = (n, d) => Math.round(n * 10 ** d) / 10 ** d
  for (const m of out.values()) {
    Object.assign(m, {
      e1rm: r(m.e1rm, 1), maxLoad: r(m.maxLoad, 1), total: Math.round(m.total),
      e1rmRel: r(m.e1rmRel, 3), maxLoadRel: r(m.maxLoadRel, 3), totalRel: r(m.totalRel, 1),
      bw: currentBw || 0,
    })
  }
  return out
}

// ---- Gráficas ----
export function exerciseTimeline(sets) {
  return [...groupBy(sets, (s) => s.date)].map(([date, ss]) => {
    const work = ss.filter((s) => !s.warmup)
    const src = work.length ? work : ss
    return {
      date,
      volume: Math.round(ss.reduce((a, s) => a + volume(s), 0)),
      maxWeight: Math.max(...src.map(load)),
      e1rm: round1(Math.max(...src.map(e1rm))),
    }
  })
}

export function byMuscle(sets, exMap) {
  const out = {}
  for (const s of sets) {
    const ex = exMap.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.muscles) {
      out[m] ??= { muscle: m, volume: 0, sets: 0, reps: 0 }
      out[m].volume += volume(s)
      out[m].sets += 1
      out[m].reps += s.reps
    }
  }
  return Object.values(out).sort((a, b) => b.sets - a.sets)
}

export function byExercise(sets, exMap) {
  return [...groupBy(sets, (s) => s.exerciseId)]
    .map(([id, ss]) => ({ exercise: exMap.get(id), ...totals(ss) }))
    .filter((x) => x.exercise)
    .sort((a, b) => b.volume - a.volume)
}

export function weekly(sets) {
  const wk = (d) => {
    const x = new Date(d + 'T12:00:00')
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    return x.toISOString().slice(0, 10)
  }
  return [...groupBy(sets, (s) => wk(s.date))].map(([week, ss]) => ({ week, ...totals(ss) }))
}

// ---- Formato ----
export const fmtKg = (n) =>
  n >= 10000
    ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} t`
    : `${Math.round(n).toLocaleString('es-ES')} kg`

export const fmtNum = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 })

export const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-ES', opts)

export const shortDate = (d) => fmtDate(d, { day: 'numeric', month: 'short' })
