// Utilidades de interfaz: creación de elementos, repintado y componentes comunes.

// h('button', { class: 'x', onclick: fn }, 'texto', otroNodo, [lista])
// Las claves on* son eventos (onclick, oninput…). El resto se asigna como
// propiedad del elemento si existe (value, checked, disabled…) o como atributo.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag)
  append(el, kids)
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k === 'style') el.style.cssText = v
    else if (k in el) el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  return el
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue
    if (Array.isArray(k)) append(el, k)
    else el.append(k instanceof Node ? k : String(k))
  }
}

// ---- Repintado ----
let renderFn = () => {}
export const setRenderer = (fn) => { renderFn = fn }
export const rerender = () => renderFn()

// Tareas a ejecutar cuando la pantalla ya está en el DOM (gráficas, foco…)
const mounts = []
export const onMount = (fn) => mounts.push(fn)
export const flushMounts = () => { while (mounts.length) mounts.shift()() }

// ---- Gráficas (Chart.js, cargado como script global) ----
const charts = []
export const destroyCharts = () => { while (charts.length) charts.pop().destroy() }
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()

// datasets: [{ label, data, color }]
export function chart(height, { type, labels, datasets, fmt, yTick, yMin, yMax }) {
  const canvas = h('canvas')
  const box = h('div', { style: `position:relative;height:${height}px` }, canvas)
  onMount(() => {
    const muted = cssVar('--muted'), text = cssVar('--text'), card = cssVar('--card')
    const ds = datasets.map(({ color, ...d }) => type === 'line'
      ? { borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 4, pointHoverRadius: 5,
          pointBorderWidth: 2, pointBorderColor: card, pointBackgroundColor: color, ...d }
      : { backgroundColor: color, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 28, ...d })
    const ticks = { color: muted, font: { size: 11 } }
    charts.push(new window.Chart(canvas, {
      type,
      data: { labels, datasets: ds },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d0f14', borderColor: cssVar('--line'), borderWidth: 1, padding: 10,
            titleColor: text, bodyColor: text, boxPadding: 4,
            callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt ? fmt(c.parsed.y) : c.parsed.y}` },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { ...ticks, maxRotation: 0, autoSkipPadding: 10 } },
          y: {
            ...(yMin != null && { min: yMin }), ...(yMax != null && { max: yMax }),
            grid: { color: cssVar('--grid') }, border: { display: false },
            ticks: { ...ticks, ...(yTick && { callback: yTick }) },
          },
        },
      },
    }))
  })
  return box
}

// ---- Aviso flotante ----
export function toast(msg) {
  const el = h('div', { class: 'toast' }, msg)
  document.body.append(el)
  setTimeout(() => el.remove(), 4000)
}

// ---- Casilla numérica grande (kg, repes) ----
export function bigInput({ label, value, decimals = false }) {
  const input = h('input', {
    type: 'number', inputMode: decimals ? 'decimal' : 'numeric', step: 'any', min: 0,
    value: Number.isFinite(value) ? value : '',
    onfocus: (e) => e.target.select(),
  })
  return { input, el: h('label', { class: 'big' }, h('small', null, label), input) }
}

// ---- Buscador de ejercicios ----
// onCreate(nombre): si se pasa, muestra arriba la opción de crear un ejercicio nuevo
export function exercisePicker({ exercises, exclude = [], onPick, onClose, onCreate }) {
  const ul = h('ul')
  const input = h('input', { placeholder: 'Buscar ejercicio o músculo', oninput: () => fill() })
  function fill() {
    const typed = input.value.trim()
    const q = typed.toLowerCase()
    const list = exercises.filter((e) =>
      !exclude.includes(e.id) && (e.name + ' ' + e.muscles.join(' ')).toLowerCase().includes(q))
    const exact = exercises.some((e) => e.name.toLowerCase() === q)
    ul.replaceChildren(
      ...(onCreate && !exact ? [h('li', { class: 'create', onclick: () => onCreate(typed) },
        h('span', null, typed ? `+ Crear «${typed}»` : '+ Crear ejercicio nuevo'))] : []),
      ...list.map((e) => h('li', { onclick: () => { input.value = ''; onPick(e.id) } },
        h('span', null, e.name), h('small', null, e.muscles.join(' · ')))),
      ...(list.length || onCreate ? [] : [h('li', { class: 'muted' }, 'Sin resultados. Puedes crearlo en tu perfil → Ejercicios.')]),
    )
  }
  fill()
  onMount(() => input.focus())
  return h('div', { class: 'picklist' },
    h('div', { class: 'row-input' }, input, onClose && h('button', { class: 'ghost', onclick: onClose }, 'Cerrar')),
    ul,
  )
}

// ---- Avatar: foto o inicial ----
export function avatar(photo, name, size = 36) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px`
  if (photo) return h('img', { class: 'avatar', src: photo, alt: '', referrerPolicy: 'no-referrer', style })
  return h('span', { class: 'avatar', style }, (name || '?').trim().charAt(0).toUpperCase() || '?')
}
