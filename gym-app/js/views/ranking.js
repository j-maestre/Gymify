import { avatar, h, rerender } from '../ui.js'
import { getData, getRanking } from '../data/repo.js'
import { SEED_EXERCISES } from '../data/seed.js'
import { fmtKg, fmtNum } from '../data/stats.js'

const METRICS = [['e1rm', '1RM est.'], ['maxLoad', 'Peso máx.'], ['total', 'Total']]
const st = { key: SEED_EXERCISES[0].key, metric: 'e1rm', rel: false, scope: 'friends', rows: null, rowsFor: null, loading: false, error: null }

export const refreshRanking = () => { st.rowsFor = null }

const fmt = (v, metric, rel) => {
  if (rel) return metric === 'total' ? `${fmtNum(Math.round(v))}×` : `${v.toFixed(2)}×`
  return metric === 'total' ? fmtKg(v) : `${fmtNum(v)} kg`
}

export function Ranking({ openProfile }) {
  const { account } = getData()
  if (account.status !== 'cloud') {
    return h('section', { class: 'card' },
      h('h3', null, 'Rankings'),
      h('p', { class: 'hint' }, 'Inicia sesión para compararte con tus amigos y con el resto de usuarios.'),
      h('button', { class: 'primary', onclick: openProfile }, 'Ir a mi perfil'))
  }
  if (!account.profile.alias) {
    return h('section', { class: 'card' },
      h('p', { class: 'hint' }, 'Elige un alias en tu perfil para aparecer en los rankings.'),
      h('button', { class: 'primary', onclick: openProfile }, 'Ir a mi perfil'))
  }

  const params = JSON.stringify([st.key, st.metric, st.rel, st.scope])
  if (st.rowsFor !== params && !st.loading) {
    st.loading = true
    st.error = null
    getRanking({ key: st.key, metric: st.metric, rel: st.rel, scope: st.scope })
      .then((rows) => { st.rows = rows })
      .catch((e) => { st.error = e.message; st.rows = [] })
      .finally(() => { st.loading = false; st.rowsFor = params; rerender() })
  }
  const set = (patch) => { Object.assign(st, patch); rerender() }
  const seg = (items, cur, key) => h('div', { class: 'seg' }, items.map(([v, t]) =>
    h('button', { class: cur === v ? 'on' : '', onclick: () => set({ [key]: v }) }, t)))

  const select = h('select', { onchange: (e) => set({ key: e.target.value }) },
    SEED_EXERCISES.map((e) => h('option', { value: e.key }, e.name)))
  select.value = st.key

  return h('div', { class: 'view' },
    seg([['friends', '👥 Amigos'], ['global', '🌍 Global']], st.scope, 'scope'),
    select,
    seg(METRICS, st.metric, 'metric'),
    seg([[false, 'Absoluto (kg)'], [true, 'Relativo (× peso)']], st.rel, 'rel'),
    h('section', { class: 'card' },
      st.loading || st.rowsFor !== params
        ? h('p', { class: 'empty' }, 'Cargando…')
        : st.error
        ? h('p', { class: 'error' }, st.error)
        : st.rows.length
        ? h('ol', { class: 'rank' }, st.rows.map((r, i) =>
            h('li', { class: r.me ? 'me' : '' },
              h('span', { class: 'pos' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
              avatar(r.photo, r.alias, 32),
              h('span', { class: 'grow' }, r.alias, r.me ? ' (tú)' : ''),
              h('b', null, fmt(r.value, st.metric, st.rel)),
            )))
        : h('p', { class: 'empty' }, st.scope === 'friends'
            ? 'Nadie de tus amigos tiene marcas en este ejercicio todavía.'
            : 'Aún no hay marcas en este ejercicio.'),
    ),
    st.rel && h('p', { class: 'hint' }, 'Relativo = kg divididos entre el peso corporal de ese día. Registra tu peso en el perfil.'),
    h('p', { class: 'hint' }, 'Solo cuentan los ejercicios predefinidos, para que todos comparen lo mismo.'),
  )
}
