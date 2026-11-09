import { bigInput, chart, h } from '../ui.js'
import { deleteBodyweight, getData, saveBodyweight, today } from '../data/repo.js'
import { fmtDate, fmtNum, shortDate } from '../data/stats.js'

const st = { date: null }

export function Bodyweight({ onBack }) {
  const { bw: entries } = getData()
  const last = entries.at(-1)
  const value = last ? Math.round(last.kg * 10) / 10 : 75
  const kgIn = bigInput({ label: 'kg', value, decimals: true })
  const error = h('p', { class: 'error' })
  const diff = entries.length > 1 ? last.kg - entries[0].kg : 0
  const kgs = entries.map((e) => e.kg)

  const save = () => {
    const kg = parseFloat(kgIn.input.value.replace(',', '.'))
    if (!(kg > 0)) { error.textContent = 'Pon un peso válido'; return }
    saveBodyweight(st.date || today(), Math.round(kg * 10) / 10)
  }

  return h('div', { class: 'view' },
    h('header', { class: 'head' }, h('h1', null, h('button', { class: 'back', onclick: onBack }, '‹'), 'Peso corporal')),

    h('section', { class: 'card' },
      h('div', { class: 'big-inputs one' }, kgIn.el),
      error,
      h('div', { class: 'form-actions' },
        h('input', { type: 'date', value: st.date || today(), max: today(), onchange: (e) => { st.date = e.target.value || null } }),
        h('button', { class: 'primary', onclick: save }, 'Guardar'),
      ),
      h('p', { class: 'hint' }, 'Se usa para sumar tu peso en ejercicios de peso propio y para los récords relativos.'),
    ),

    entries.length > 0 && h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('small', null, 'Actual'), h('b', null, `${fmtNum(last.kg)} kg`)),
      h('div', { class: 'tile' }, h('small', null, 'Cambio total'), h('b', null, `${diff > 0 ? '+' : ''}${fmtNum(diff)} kg`)),
    ),

    entries.length > 1 && h('section', { class: 'card' },
      h('h3', null, 'Evolución'),
      chart(180, {
        type: 'line',
        labels: entries.map((e) => shortDate(e.date)),
        datasets: [{ label: 'Peso', data: kgs, color: '#6688f0' }],
        fmt: (v) => `${fmtNum(v)} kg`,
        yTick: (v) => `${Math.round(v)} kg`,
        yMin: Math.floor(Math.min(...kgs) - 1),
        yMax: Math.ceil(Math.max(...kgs) + 1),
      }),
    ),

    h('section', { class: 'card' },
      h('ul', { class: 'sets' }, [...entries].reverse().map((e) =>
        h('li', null,
          h('span', { class: 'grow' }, fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })),
          h('b', null, `${fmtNum(e.kg)} kg`),
          h('button', { class: 'del', onclick: () => deleteBodyweight(e.date) }, '✕'),
        ))),
      !entries.length && h('p', { class: 'empty' }, 'Sin registros todavía.'),
    ),
  )
}
