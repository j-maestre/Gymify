import { chart, h, rerender } from '../ui.js'
import { getData } from '../data/repo.js'
import { byExercise, byMuscle, exerciseTimeline, fmtDate, fmtKg, totals, weekly } from '../data/stats.js'

const C1 = '#6688f0' // azul: series principales
const C2 = '#c06e3a' // naranja: segunda serie
const RANGES = [
  { id: 30, label: '30 d' }, { id: 90, label: '3 m' }, { id: 365, label: '1 año' }, { id: 0, label: 'Todo' },
]
const label = (d) => fmtDate(d, { day: 'numeric', month: 'short' })

const st = { range: 90, exId: null, muscleMetric: 'sets' }
const set = (patch) => { Object.assign(st, patch); rerender() }

export function Stats() {
  const { exMap, sets: allSets } = getData()
  if (!allSets.length)
    return h('div', { class: 'view' }, 
      h('p', { class: 'empty' }, 'Registra algún entrenamiento para ver tus gráficas.'))

  const from = st.range ? new Date(Date.now() - st.range * 864e5).toISOString().slice(0, 10) : ''
  const sets = allSets.filter((s) => s.date >= from)

  const t = totals(sets)
  const days = new Set(sets.map((s) => s.date)).size
  const warm = sets.filter((s) => s.warmup).length
  const muscles = byMuscle(sets, exMap)
  const perEx = byExercise(sets, exMap)
  const weeks = weekly(sets)

  const selected = perEx.some((x) => x.exercise.id === st.exId) ? st.exId : perEx[0]?.exercise.id
  const timeline = exerciseTimeline(sets.filter((s) => s.exerciseId === selected))
  const mMax = Math.max(...muscles.map((x) => x[st.muscleMetric]))

  const tile = (name, value) => h('div', { class: 'tile' }, h('small', null, name), h('b', null, value))
  const seg = (items, cur, key, cls = 'seg') => h('div', { class: cls }, items.map(([id, text]) =>
    h('button', { class: cur === id ? 'on' : '', onclick: () => set({ [key]: id }) }, text)))

  return h('div', { class: 'view' },
    
    seg(RANGES.map((r) => [r.id, r.label]), st.range, 'range'),

    h('div', { class: 'tiles' },
      tile('Peso total levantado', fmtKg(t.volume)),
      tile('Entrenamientos', days),
      tile('Series', t.sets),
      tile('Repeticiones', t.reps.toLocaleString('es-ES')),
      tile('Series de calentamiento', warm),
      tile('Ejercicios distintos', perEx.length),
    ),

    h('section', { class: 'card' },
      h('h3', null, 'Volumen por semana'),
      chart(180, {
        type: 'bar',
        labels: weeks.map((w) => label(w.week)),
        datasets: [{ label: 'Volumen', data: weeks.map((w) => w.volume), color: C1 }],
        fmt: fmtKg,
        yTick: (v) => (v >= 1000 ? `${v / 1000}t` : v),
      }),
    ),

    h('section', { class: 'card' },
      h('div', { class: 'card-title' },
        h('h3', null, 'Músculos'),
        seg([['sets', 'Series'], ['volume', 'Kg']], st.muscleMetric, 'muscleMetric', 'seg small'),
      ),
      h('div', { class: 'hbars' }, muscles.map((m) => {
        const v = m[st.muscleMetric]
        return h('div', { class: 'hbar', title: `${m.sets} series · ${m.reps} repes · ${fmtKg(m.volume)}` },
          h('span', null, m.muscle),
          h('div', { class: 'track' }, h('div', { style: `width:${(v / mMax) * 100}%` })),
          h('b', null, st.muscleMetric === 'sets' ? v : fmtKg(v)),
        )
      })),
    ),

    perEx.length > 0 && h('section', { class: 'card' },
      h('div', { class: 'card-title' }, h('h3', null, 'Evolución por ejercicio')),
      h('select', { value: String(selected), onchange: (e) => set({ exId: perEx.find((x) => String(x.exercise.id) === e.target.value)?.exercise.id }) },
        perEx.map((x) => h('option', { value: x.exercise.id }, x.exercise.name))),
      h('p', { class: 'legend' },
        h('span', null, h('i', { style: `background:${C1}` }), 'Peso máx.'),
        h('span', null, h('i', { style: `background:${C2}` }), '1RM estimado'),
      ),
      chart(180, {
        type: 'line',
        labels: timeline.map((d) => label(d.date)),
        datasets: [
          { label: 'Peso máx.', data: timeline.map((d) => d.maxWeight), color: C1 },
          { label: '1RM est.', data: timeline.map((d) => d.e1rm), color: C2 },
        ],
        fmt: (v) => `${v} kg`,
        yTick: (v) => `${v} kg`,
      }),
      h('h4', null, 'Volumen por sesión'),
      chart(140, {
        type: 'bar',
        labels: timeline.map((d) => label(d.date)),
        datasets: [{ label: 'Volumen', data: timeline.map((d) => d.volume), color: C1, maxBarThickness: 24 }],
        fmt: fmtKg,
      }),
    ),
  )
}
