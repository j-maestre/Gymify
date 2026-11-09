import { avatar, h, rerender } from '../ui.js'
import {
  exportData, getData, importData, resetPassword, saveProfile, signInEmail, signInGoogle, signOut, signUpEmail,
} from '../data/repo.js'
import { fmtNum } from '../data/stats.js'
import { Exercises, resetExercises } from './exercises.js'
import { Bodyweight } from './bodyweight.js'
import { Friends } from './friends.js'

const st = { page: null }
const go = (page) => { st.page = page; rerender(); window.scrollTo(0, 0) }

export function resetProfile() {
  st.page = null
  resetExercises()
}

export function Profile({ onBack }) {
  const back = () => go(null)
  if (st.page === 'exercises') return Exercises({ onBack: back })
  if (st.page === 'bodyweight') return Bodyweight({ onBack: back })
  if (st.page === 'friends') return Friends({ onBack: back })

  const { account, bw, exercises } = getData()
  const signed = account.status === 'cloud'
  const pending = account.friendships.filter((f) => f.status === 'pending' && f.to === account.user?.uid).length

  return h('div', { class: 'view' },
    h('header', { class: 'head' }, h('h1', null, h('button', { class: 'back', onclick: onBack }, '‹'), 'Perfil')),

    account.status === 'loading' && h('p', { class: 'empty' }, 'Conectando con tu cuenta…'),
    account.status === 'local' && loginCard(account),
    signed && accountCard(account),

    h('section', { class: 'card menu' },
      h('button', { onclick: () => go('bodyweight') },
        h('span', null, '⚖️ Peso corporal'), h('small', null, `${bw.length ? `${fmtNum(bw.at(-1).kg)} kg` : 'Sin registrar'} ›`)),
      signed && h('button', { onclick: () => go('friends') },
        h('span', null, '👥 Amigos', pending ? h('span', { class: 'badge' }, pending) : null),
        h('small', null, `${account.friendships.filter((f) => f.status === 'accepted').length} ›`)),
      h('button', { onclick: () => go('exercises') },
        h('span', null, '📋 Ejercicios'), h('small', null, `${exercises.length} ›`)),
    ),

    backupCard(signed),
    signed && h('button', { class: 'danger wide', onclick: () => confirm('¿Cerrar sesión?') && signOut() }, 'Cerrar sesión'),
  )
}

// ---- Sin sesión: Google o email ----
const AUTH_ERRORS = {
  'auth/invalid-credential': 'Email o contraseña incorrectos',
  'auth/invalid-email': 'El email no es válido',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email. Pulsa "Entrar".',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
  'auth/missing-password': 'Escribe la contraseña',
  'auth/popup-closed-by-user': 'Has cerrado la ventana de Google',
  'auth/network-request-failed': 'Sin conexión',
  'auth/too-many-requests': 'Demasiados intentos. Espera un poco.',
}

function loginCard(account) {
  const email = h('input', { type: 'email', placeholder: 'tu@email.com', autocomplete: 'email' })
  const pass = h('input', { type: 'password', placeholder: 'Contraseña', autocomplete: 'current-password' })
  const msg = h('p', { class: 'error' })
  const run = async (fn) => {
    msg.className = 'error'
    msg.textContent = ''
    try { await fn() } catch (e) { msg.textContent = AUTH_ERRORS[e.code] || e.message }
  }
  return h('section', { class: 'card' },
    h('h3', null, 'Tu cuenta'),
    h('p', { class: 'hint' }, 'Inicia sesión para guardar tus entrenamientos en la nube, usarlos en varios dispositivos, añadir amigos y entrar en los rankings.'),
    !account.available && h('p', { class: 'error' }, 'Sin conexión con el servidor. Conéctate a internet para iniciar sesión.'),
    h('button', { class: 'google', onclick: () => run(signInGoogle) }, h('b', null, 'G'), 'Continuar con Google'),
    h('p', { class: 'or' }, 'o con tu email'),
    h('div', { class: 'stack' }, email, pass),
    msg,
    h('div', { class: 'actions' },
      h('button', { class: 'ghost', onclick: () => run(() => signUpEmail(email.value.trim(), pass.value)) }, 'Crear cuenta'),
      h('button', { class: 'primary', onclick: () => run(() => signInEmail(email.value.trim(), pass.value)) }, 'Entrar'),
    ),
    h('button', {
      class: 'link',
      onclick: () => run(async () => {
        if (!email.value.trim()) throw new Error('Escribe tu email arriba')
        await resetPassword(email.value.trim())
        msg.className = 'ok'
        msg.textContent = 'Te hemos enviado un email para cambiar la contraseña'
      }),
    }, '¿Has olvidado la contraseña?'),
  )
}

// ---- Con sesión: datos del perfil ----
function accountCard(account) {
  const { user, profile } = account
  const p = { alias: profile.alias || '', sex: profile.sex || '', birthDate: profile.birthDate || '', height: profile.height || '' }
  const alias = h('input', { placeholder: 'Tu alias (lo verán los demás)', value: p.alias, maxLength: 20 })
  const sex = h('select', null,
    [['', '—'], ['m', 'Hombre'], ['f', 'Mujer'], ['x', 'Otro']].map(([v, t]) => h('option', { value: v }, t)))
  sex.value = p.sex
  const birth = h('input', { type: 'date', value: p.birthDate, max: new Date().toISOString().slice(0, 10) })
  const height = h('input', { type: 'number', inputMode: 'numeric', placeholder: 'cm', value: p.height, min: 100, max: 250 })
  const msg = h('p', { class: 'error' })

  const save = async () => {
    msg.className = 'error'
    const a = alias.value.trim()
    if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(a)) { msg.textContent = 'El alias debe tener 3–20 letras, números, punto, guion o guion bajo'; return }
    try {
      await saveProfile({ alias: a, sex: sex.value, birthDate: birth.value, height: height.value ? Number(height.value) : null })
      msg.className = 'ok'
      msg.textContent = 'Guardado'
    } catch (e) { msg.textContent = e.message }
  }

  const field = (label, input) => h('label', { class: 'field' }, h('small', null, label), input)

  return h('section', { class: 'card' },
    h('div', { class: 'me' },
      avatar(user.photo, profile.alias || user.name || user.email, 52),
      h('div', null, h('b', null, profile.alias || user.name || 'Sin alias'), h('small', null, user.email)),
    ),
    !profile.alias && h('p', { class: 'hint warn' }, 'Elige un alias para que tus amigos te encuentren y aparecer en los rankings.'),
    field('Alias', alias),
    h('div', { class: 'two' }, field('Sexo', sex), field('Altura (cm)', height)),
    field('Fecha de nacimiento', birth),
    msg,
    h('button', { class: 'primary', onclick: save }, 'Guardar perfil'),
    h('p', { class: 'hint' }, 'Los demás solo ven tu alias, tu foto y tus marcas. Tu altura, fecha de nacimiento y entrenamientos son privados.'),
  )
}

function backupCard(signed) {
  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportData())], { type: 'application/json' })
    h('a', { href: URL.createObjectURL(blob), download: `gymlog-${new Date().toISOString().slice(0, 10)}.json` }).click()
  }
  const doImport = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f || !confirm('Esto sustituirá todos tus datos actuales. ¿Continuar?')) return
    try { await importData(JSON.parse(await f.text())); alert('Datos importados') }
    catch (err) { alert('Error: ' + err.message) }
  }
  const file = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: doImport })
  return h('section', { class: 'card' },
    h('h3', null, 'Copia de seguridad'),
    h('p', { class: 'hint' }, signed
      ? 'Tus datos están en tu cuenta. También puedes descargar una copia.'
      : 'Sin sesión, tus datos se guardan solo en este dispositivo. Exporta de vez en cuando.'),
    h('div', { class: 'actions' },
      h('button', { class: 'ghost', onclick: doExport }, 'Exportar'),
      h('button', { class: 'ghost', onclick: () => file.click() }, 'Importar'),
      file,
    ),
  )
}
