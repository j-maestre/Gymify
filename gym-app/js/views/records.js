import { h, rerender } from '../ui.js'
import { getData } from '../data/repo.js'
import { computePRs, e1rm, fmtKg, fmtNum, REP_MAXES, round1, shortDate, volume } from '../data/stats.js'

// Métricas listas para el ranking futuro: absoluto y relativo al peso corporal.
const st = { mode: 'abs', open: null }

export function Records() {
  const { exMap, sets } = getData()
  const prs = computePRs(sets)
  const rel = st.mode === 'rel'
  const val = (s, v = s.load) => {
    if (!rel) return `${fmtNum(round1(v))} kg`
    return s.bw ? `${(v / s.bw).toFixed(2)}×` : '—'
  }
  const noBw = rel && !sets.some((s) => s.bw)

  const list = [...prs.byEx.values()]
    .filter((r) => exMap.has(r.exerciseId))
    .map((r) => ({
      ...r,
      ex: exMap.get(r.exerciseId),
      total: sets.filter((s) => s.exerciseId === r.exerciseId).reduce((a, s) => a + volume(s), 0),
    }))
    .sort((a, b) => e1rm(b.best) - e1rm(a.best))

  const recent = prs.events.slice(-10).reverse()
  const head = null

  if (!list.length) return h('div', { class: 'view' }, head, h('p', { class: 'empty' }, 'Aquí aparecerán tus récords personales.'))

  const setMode = (mode) => { st.mode = mode; rerender() }

  return h('div', { class: 'view' },
    head,
    h('div', { class: 'seg' },
      h('button', { class: !rel ? 'on' : '', onclick: () => setMode('abs') }, 'Absoluto (kg)'),
      h('button', { class: rel ? 'on' : '', onclick: () => setMode('rel') }, 'Relativo (× peso)'),
    ),
    noBw && h('p', { class: 'hint' }, 'Registra tu peso corporal en tu perfil → Peso corporal para ver los valores relativos.'),

    recent.length > 0 && h('section', { class: 'card' },
      h('h3', null, 'Últimos PRs'),
      h('ul', { class: 'feed' }, recent.map(({ set: s, types }) =>
        h('li', null,
          h('span', { class: 'trophy' }, '🏆'),
          h('div', null,
            h('b', null, exMap.get(s.exerciseId)?.name),
            h('small', null, `${s.reps} × ${fmtNum(s.load)} kg · ${types.join(' · ')}`),
          ),
          h('small', null, shortDate(s.date)),
        ))),
    ),

    h('section', { class: 'card' },
      h('h3', null, 'Por ejercicio'),
      h('ul', { class: 'records' }, list.map((r) =>
        h('li', { onclick: () => { st.open = st.open === r.exerciseId ? null : r.exerciseId; rerender() } },
          h('div', { class: 'rec-head' },
            h('b', null, r.ex.name),
            h('span', { class: 'rec-main' },
              h('small', null, '1RM est.'), ' ', r.best.load ? val(r.best, e1rm(r.best)) : `${r.maxReps.reps} rep`),
          ),
          h('div', { class: 'rec-row' },
            h('span', null, h('small', null, 'Peso máx.'), ' ', r.maxLoad.load ? `${val(r.maxLoad)} × ${r.maxLoad.reps}` : '—'),
            h('span', null, h('small', null, 'Máx. repes'), ' ', r.maxReps.reps,
              r.maxReps.load ? ` × ${fmtNum(r.maxReps.load)} kg` : ''),
            h('span', null, h('small', null, 'Total'), ' ', fmtKg(r.total)),
          ),
          st.open === r.exerciseId && h('div', { class: 'repmax' }, REP_MAXES.map((n) => {
            const s = r.repMax[n]
            return h('div', null, h('small', null, `${n}RM`), h('b', null, s ? val(s) : '—'), s && h('small', null, shortDate(s.date)))
          })),
        ))),
      h('p', { class: 'hint' }, 'Toca un ejercicio para ver tus mejores marcas por número de repeticiones.'),
    ),
  )
}
