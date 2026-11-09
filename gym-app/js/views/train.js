import { avatar, bigInput, exercisePicker, h, onMount, rerender, toast } from '../ui.js'
import { addExercise, addSet, deleteSet, getData, setSessionExercises, today, updateSet } from '../data/repo.js'
import { computePRs, fmtDate, fmtKg, fmtNum, groupBy, shortDate, totals, volume } from '../data/stats.js'
import { MUSCLES } from '../data/seed.js'

// exId: ejercicio abierto en la ficha · editId: serie que se está corrigiendo · creating: ejercicio nuevo
const st = { exId: null, editId: null, picking: false, repeating: false, creating: null }
export const resetTrain = () => Object.assign(st, { exId: null, editId: null, picking: false, repeating: false, creating: null })

// "60×10 · 70×8" (kg × repes), como en el bloc de notas
const setText = (s, ex) => `${s.warmup ? 'c ' : ''}${ex?.bodyweight ? '+' : ''}${fmtNum(s.weight)}×${s.reps}`
const setsText = (ss, ex) => ss.map((s) => setText(s, ex)).join(' · ')
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Train({ date, setDate, openProfile }) {
  const day = date || today()
  const { exercises, exMap, sets, sessions, account } = getData()
  if (st.exId && exMap.has(st.exId)) return Ficha(exMap.get(st.exId), day)

  const daySets = sets.filter((s) => s.date === day)
  const planned = sessions.get(day)?.exerciseIds ?? []
  const extra = [...new Set(daySets.map((s) => s.exerciseId))].filter((id) => !planned.includes(id))
  const ids = [...planned, ...extra].filter((id) => exMap.has(id))

  const open = (id) => {
    Object.assign(st, { exId: id, editId: null, picking: false })
    window.scrollTo(0, 0)
    if (ids.includes(id)) rerender()
    else setSessionExercises(day, [...ids, id])
  }

  // Ejercicios recientes primero en el buscador
  const lastTs = new Map()
  for (const s of sets) lastTs.set(s.exerciseId, s.ts)
  const byRecent = [...exercises].sort((a, b) => (lastTs.get(b.id) || 0) - (lastTs.get(a.id) || 0))

  const t = totals(daySets)

  return h('div', { class: 'view' },
    h('header', { class: 'head' },
      h('div', null,
        h('h1', null, day === today() ? 'Hoy' : fmtDate(day)),
        h('input', { type: 'date', class: 'date', value: day, max: today(), onchange: (e) => { resetTrain(); setDate(e.target.value || null) } }),
      ),
      h('button', { class: 'icon-btn', 'aria-label': 'Perfil', onclick: openProfile },
        account.user ? avatar(account.user.photo, account.profile.alias || account.user.name || account.user.email, 34) : h('span', { class: 'avatar', style: 'width:34px;height:34px;font-size:18px' }, '👤')),
    ),
    daySets.length > 0 && h('p', { class: 'summary' },
      `${plural(ids.length, 'ejercicio')} · ${plural(t.sets, 'serie')} · ${fmtKg(t.volume)}`),

    ids.length > 0 && h('section', { class: 'card today' }, ids.map((id) => {
      const ex = exMap.get(id)
      const ss = daySets.filter((s) => s.exerciseId === id)
      return h('div', { class: 'ex-row', onclick: () => open(id) },
        h('div', { class: 'ex-line' },
          h('b', null, ex.name),
          ss.length
            ? h('small', null, fmtKg(ss.reduce((a, s) => a + volume(s), 0)))
            : h('button', {
                class: 'del', 'aria-label': 'Quitar',
                onclick: (e) => { e.stopPropagation(); setSessionExercises(day, ids.filter((x) => x !== id)) },
              }, '✕'),
        ),
        h('div', { class: 'sets-text' }, ss.length ? setsText(ss, ex) : 'Sin series todavía'),
      )
    })),

    st.creating
      ? newExerciseForm(open)
      : st.picking
      ? h('section', { class: 'card' },
          exercisePicker({
            exercises: byRecent, onPick: open,
            onClose: () => { st.picking = false; rerender() },
            onCreate: (name) => { st.creating = { name, muscles: [], bodyweight: false }; rerender() },
          }))
      : h('button', { class: 'primary', onclick: () => { st.picking = true; st.repeating = false; rerender() } }, '+ Ejercicio'),

    !ids.length && !st.picking && repeatSection(day, sets, exMap),
  )
}

// ---- Crear un ejercicio nuevo sin salir de Hoy ----
function newExerciseForm(open) {
  const ed = st.creating
  const name = h('input', { placeholder: 'Nombre del ejercicio', value: ed.name, oninput: (e) => { ed.name = e.target.value } })
  const error = h('p', { class: 'error' })
  if (!ed.name) onMount(() => name.focus())
  const toggle = (m, btn) => {
    ed.muscles = ed.muscles.includes(m) ? ed.muscles.filter((x) => x !== m) : [...ed.muscles, m]
    btn.classList.toggle('on', ed.muscles.includes(m))
  }
  const save = async () => {
    const n = ed.name.trim()
    if (!n) { error.textContent = 'Ponle un nombre'; return }
    if (getData().exercises.some((e) => e.name.toLowerCase() === n.toLowerCase())) { error.textContent = 'Ya existe un ejercicio con ese nombre'; return }
    if (!ed.muscles.length) { error.textContent = 'Elige al menos un músculo'; return }
    st.creating = null
    st.picking = false
    const id = await addExercise({ name: n, muscles: ed.muscles, bodyweight: ed.bodyweight })
    open(id)
  }
  return h('section', { class: 'card' },
    h('h3', null, 'Nuevo ejercicio'),
    name,
    h('p', { class: 'hint' }, 'Músculos que trabaja'),
    h('div', { class: 'chips' }, MUSCLES.map((m) =>
      h('button', { class: `chip ${ed.muscles.includes(m) ? 'on' : ''}`, onclick: (e) => toggle(m, e.currentTarget) }, m))),
    h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: ed.bodyweight, onchange: (e) => { ed.bodyweight = e.target.checked } }),
      'Es de peso corporal (dominadas, fondos…)'),
    error,
    h('div', { class: 'actions' },
      h('button', { class: 'ghost', onclick: () => { st.creating = null; rerender() } }, 'Cancelar'),
      h('button', { class: 'primary', onclick: save }, 'Crear y apuntar'),
    ),
  )
}

// ---- Repetir un entrenamiento anterior ----
function repeatSection(day, sets, exMap) {
  if (!st.repeating) {
    const any = sets.some((s) => s.date < day)
    return any && h('button', { class: 'ghost wide dashed', onclick: () => { st.repeating = true; rerender() } },
      'Repetir un entrenamiento anterior')
  }
  const days = [...groupBy(sets.filter((s) => s.date < day), (s) => s.date)]
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)
  return h('section', { class: 'card' },
    h('div', { class: 'card-title' },
      h('h3', null, '¿Qué entrenamiento repites?'),
      h('button', { class: 'ghost', onclick: () => { st.repeating = false; rerender() } }, 'Cerrar'),
    ),
    h('div', { class: 'routine-grid' }, days.map(([date, ss]) => {
      const exIds = [...new Set(ss.map((s) => s.exerciseId))].filter((id) => exMap.has(id))
      return h('button', {
        class: 'routine-btn',
        onclick: () => { st.repeating = false; setSessionExercises(day, exIds, null) },
      },
        h('b', null, fmtDate(date)),
        h('small', null, exIds.map((id) => exMap.get(id).name).join(', ')),
      )
    })),
  )
}

// ---- Ficha de un ejercicio: apuntar series ----
function Ficha(ex, day) {
  const { sets, bwAt } = getData()
  const exSets = sets.filter((s) => s.exerciseId === ex.id)
  const mine = exSets.filter((s) => s.date === day)
  const prevDate = exSets.filter((s) => s.date < day).at(-1)?.date
  const prev = prevDate ? exSets.filter((s) => s.date === prevDate) : []
  const rec = computePRs(sets).byEx.get(ex.id)
  const editing = st.editId ? mine.find((s) => s.id === st.editId) : null

  // Valores iniciales: la serie que se corrige, la última de hoy o la primera efectiva de la última vez
  const base = editing || mine.at(-1) || prev.find((s) => !s.warmup) || prev[0]
  const kg = bigInput({ label: ex.bodyweight ? 'lastre kg' : 'kg', value: base?.weight ?? (ex.bodyweight ? 0 : 20), decimals: true })
  const reps = bigInput({ label: 'repes', value: base?.reps ?? 10 })
  const warm = h('input', { type: 'checkbox', checked: editing?.warmup ?? false })
  const error = h('p', { class: 'error' })

  const read = () => {
    const weight = parseFloat(kg.input.value.replace(',', '.'))
    const r = parseInt(reps.input.value, 10)
    if (!(r > 0) || !(weight >= 0)) { error.textContent = 'Pon un peso y unas repeticiones válidas'; return null }
    return { weight: Math.round(weight * 100) / 100, reps: r, warmup: warm.checked }
  }

  const save = async () => {
    const v = read()
    if (!v) return
    if (editing) {
      st.editId = null
      return updateSet(editing.id, v)
    }
    const id = await addSet({ exerciseId: ex.id, date: day, ...v })
    navigator.vibrate?.(40)
    const ev = computePRs(getData().sets).events.find((e) => e.set.id === id)
    if (ev) {
      toast(`🏆 ¡Nuevo PR en ${ex.name}! ${ev.types.join(' · ')}`)
      navigator.vibrate?.([80, 60, 80, 60, 200])
    }
  }
  const back = () => { st.exId = null; st.editId = null; rerender(); window.scrollTo(0, 0) }
  const work = mine.filter((s) => !s.warmup)
  const prIds = computePRs(sets).prIds
  const bw = bwAt(day)

  return h('div', { class: 'view' },
    h('header', { class: 'head' },
      h('h1', null, h('button', { class: 'back', onclick: back }, '‹'), ex.name),
      rec?.maxLoad.load > 0 && h('small', { class: 'muted' }, `PR ${fmtNum(rec.maxLoad.load)}×${rec.maxLoad.reps}`),
    ),
    h('p', { class: 'hint' }, prev.length
      ? `Última vez (${shortDate(prevDate)}): ${setsText(prev, ex)}`
      : 'Primera vez con este ejercicio'),

    mine.length > 0 && h('section', { class: 'card' },
      h('ol', { class: 'sets' }, mine.map((s) =>
        h('li', {
          class: `${s.warmup ? 'warm' : ''} ${s.id === st.editId ? 'editing' : ''} tap`,
          onclick: () => { st.editId = st.editId === s.id ? null : s.id; rerender() },
        },
          h('span', { class: 'n' }, s.warmup ? 'C' : work.indexOf(s) + 1),
          h('span', null, `${ex.bodyweight ? '+' : ''}${fmtNum(s.weight)} kg × ${s.reps}`),
          prIds.has(s.id) && h('span', { class: 'pr' }, '🏆 PR'),
        ))),
      !editing && h('p', { class: 'hint center' }, 'Toca una serie para corregirla o borrarla'),
    ),

    h('section', { class: 'card' },
      editing && h('h3', null, 'Corregir serie'),
      h('div', { class: 'big-inputs' }, kg.el, reps.el),
      ex.bodyweight && h('p', { class: 'hint' }, bw
        ? `Se suma tu peso corporal (${fmtNum(bw)} kg).`
        : '⚠️ Registra tu peso corporal en tu perfil (arriba a la derecha) para sumarlo al total.'),
      h('label', { class: 'check small' }, warm, 'calentamiento'),
      error,
      editing
        ? h('div', { class: 'actions' },
            h('button', { class: 'danger', onclick: () => { st.editId = null; deleteSet(editing.id) } }, 'Borrar'),
            h('button', { class: 'ghost', onclick: () => { st.editId = null; rerender() } }, 'Cancelar'),
            h('button', { class: 'primary', onclick: save }, 'Guardar cambios'),
          )
        : h('button', { class: 'primary', onclick: save }, `Guardar serie ${work.length + 1}`),
    ),
  )
}
