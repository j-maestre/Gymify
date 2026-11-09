import { h } from '../ui.js'
import { getData } from '../data/repo.js'
import { fmtDate, fmtKg, groupBy, totals } from '../data/stats.js'

export function History({ onOpenDay }) {
  const { sets, exMap } = getData()
  const days = [...groupBy(sets, (s) => s.date)].sort((a, b) => b[0].localeCompare(a[0]))

  return h('div', { class: 'view' },
    h('header', { class: 'head' }, h('h1', null, 'Historial'), h('small', { class: 'muted' }, `${days.length} entrenamientos`)),
    heatmap(sets),
    days.map(([date, ss]) => {
      const t = totals(ss)
      const exs = [...groupBy(ss, (s) => s.exerciseId)]
      const muscles = [...new Set(exs.flatMap(([id]) => exMap.get(id)?.muscles ?? []))]
      return h('section', { class: 'card day', onclick: () => onOpenDay(date) },
        h('div', { class: 'card-title' },
          h('h3', null, fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
          h('small', null, fmtKg(t.volume)),
        ),
        h('ul', { class: 'day-ex' }, exs.map(([id, es]) =>
          h('li', null,
            h('span', null, exMap.get(id)?.name),
            h('small', null, es.map((s) => `${s.warmup ? 'c' : ''}${s.reps}×${s.weight}`).join('  ')),
          ))),
        h('div', { class: 'chips' }, muscles.map((m) => h('span', { class: 'chip' }, m))),
      )
    }),
    !days.length && h('p', { class: 'empty' }, 'Todavía no has registrado ningún entrenamiento.'),
  )
}

// Calendario de las últimas 16 semanas
function heatmap(sets) {
  const vol = new Map()
  for (const s of sets) vol.set(s.date, (vol.get(s.date) || 0) + s.reps * (s.load || 0) + 1)
  const max = Math.max(1, ...vol.values())

  const weeks = 16
  const start = new Date()
  start.setHours(12)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7)
  const cells = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const v = vol.get(key) || 0
    const level = v ? Math.min(4, Math.ceil((v / max) * 4)) : 0
    cells.push(h('i', { title: key, class: `l${level} ${d > new Date() ? 'future' : ''}` }))
  }
  return h('section', { class: 'card' }, h('div', { class: 'heatmap' }, cells))
}
