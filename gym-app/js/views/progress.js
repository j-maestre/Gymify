import { h, rerender } from '../ui.js'
import { Records } from './records.js'
import { Stats } from './stats.js'
import { Ranking, refreshRanking } from './ranking.js'

// Progreso = récords + gráficas + rankings
const st = { section: 'records' }

export function Progress({ openProfile }) {
  const tab = (id, text) => h('button', {
    class: st.section === id ? 'on' : '',
    onclick: () => { st.section = id; if (id === 'ranking') refreshRanking(); rerender() },
  }, text)

  return h('div', { class: 'view' },
    h('header', { class: 'head' }, h('h1', null, 'Progreso')),
    h('div', { class: 'seg' }, tab('records', '🏆 Récords'), tab('charts', '📈 Gráficas'), tab('ranking', '👥 Ranking')),
    st.section === 'records' ? Records() : st.section === 'charts' ? Stats() : Ranking({ openProfile }),
  )
}
