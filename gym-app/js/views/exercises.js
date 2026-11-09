import { h, onMount, rerender } from '../ui.js'
import { addExercise, deleteExercise, getData, updateExercise } from '../data/repo.js'
import { MUSCLES } from '../data/seed.js'

const st = { editing: null } // null | {id?, name, muscles[], bodyweight}
export const resetExercises = () => { st.editing = null }
const edit = (e) => { st.editing = e; rerender() }

export function Exercises({ onBack }) {
  const { exercises } = getData()
  const ed = st.editing

  const save = async () => {
    const { id, ...data } = ed
    if (!data.name.trim() || !data.muscles.length) return alert('Pon un nombre y al menos un músculo')
    data.name = data.name.trim()
    st.editing = null
    id ? await updateExercise(id, data) : await addExercise(data)
  }
  const remove = async () => {
    if (confirm(`¿Borrar "${ed.name}" y todas sus series?`)) { st.editing = null; await deleteExercise(ed.id) }
  }
  const toggle = (m, btn) => {
    ed.muscles = ed.muscles.includes(m) ? ed.muscles.filter((y) => y !== m) : [...ed.muscles, m]
    btn.classList.toggle('on', ed.muscles.includes(m))
  }

  let form = null
  if (ed) {
    const name = h('input', { placeholder: 'Nombre', value: ed.name, oninput: (e) => { ed.name = e.target.value } })
    onMount(() => name.focus())
    form = h('section', { class: 'card' },
      h('h3', null, ed.id ? 'Editar ejercicio' : 'Nuevo ejercicio'),
      name,
      h('p', { class: 'hint' }, 'Músculos trabajados'),
      h('div', { class: 'chips' }, MUSCLES.map((m) =>
        h('button', { class: `chip ${ed.muscles.includes(m) ? 'on' : ''}`, onclick: (e) => toggle(m, e.currentTarget) }, m))),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: ed.bodyweight, onchange: (e) => { ed.bodyweight = e.target.checked } }),
        'Peso corporal (el peso es lastre opcional)',
      ),
      h('div', { class: 'actions' },
        ed.id && h('button', { class: 'danger', onclick: remove }, 'Borrar'),
        h('button', { class: 'ghost', onclick: () => edit(null) }, 'Cancelar'),
        h('button', { class: 'primary', onclick: save }, 'Guardar'),
      ),
    )
  }

  return h('div', { class: 'view' },
    h('header', { class: 'head' },
      h('h1', null, h('button', { class: 'back', onclick: onBack }, '‹'), 'Ejercicios'),
      h('button', { class: 'ghost', onclick: () => edit({ name: '', muscles: [], bodyweight: false }) }, '+ Nuevo'),
    ),
    form,
    h('section', { class: 'card' },
      h('ul', { class: 'exlist' }, exercises.map((e) =>
        h('li', { onclick: () => { edit({ ...e, muscles: [...e.muscles] }); window.scrollTo(0, 0) } },
          h('span', null, e.name), h('small', null, e.muscles.join(' · '))))),
    ),
  )
}
