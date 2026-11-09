import { destroyCharts, flushMounts, h, setRenderer } from './ui.js'
import { getData, initAccount, subscribe } from './data/repo.js'
import { Train, resetTrain } from './views/train.js'
import { History } from './views/history.js'
import { Progress } from './views/progress.js'
import { Profile, resetProfile } from './views/profile.js'

const TABS = [
  { id: 'train', label: 'Hoy', icon: '✏️' },
  { id: 'history', label: 'Historial', icon: '📅' },
  { id: 'progress', label: 'Progreso', icon: '📈' },
]

const state = { tab: 'train', date: null }
const main = document.querySelector('main')
const nav = document.querySelector('.tabs')

function go(tab) {
  if (tab === 'train' && state.tab === 'train') { resetTrain(); state.date = null } // tocar "Hoy" otra vez vuelve al día actual
  if (tab === 'profile') resetProfile()
  state.tab = tab
  render()
  window.scrollTo(0, 0)
}

const openProfile = () => go('profile')
const VIEWS = {
  train: () => Train({ date: state.date, setDate: (d) => { state.date = d; render() }, openProfile }),
  history: () => History({ onOpenDay: (d) => { resetTrain(); state.date = d; go('train') } }),
  progress: () => Progress({ openProfile }),
  profile: () => Profile({ onBack: () => go('train') }),
}

function render() {
  destroyCharts()
  const loading = getData().account.status === 'loading' && state.tab !== 'profile'
  main.replaceChildren(loading ? h('p', { class: 'empty' }, 'Cargando tus datos…') : VIEWS[state.tab]())
  nav.replaceChildren(...TABS.map((t) =>
    h('button', { class: state.tab === t.id ? 'on' : '', onclick: () => go(t.id) },
      h('span', { class: 'ico' }, t.icon), h('span', null, t.label))))
  flushMounts()
}

setRenderer(render)
subscribe(render)
render()
initAccount()

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')
