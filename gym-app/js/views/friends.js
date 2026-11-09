import { avatar, h, onMount } from '../ui.js'
import { acceptFriend, getData, getProfile, removeFriend, requestFriend, searchProfiles } from '../data/repo.js'

// Nombre y foto de un usuario: se pinta un hueco y se rellena al llegar su perfil
function person(uid, extra) {
  const pic = h('span', { class: 'avatar', style: 'width:36px;height:36px' })
  const name = h('b', null, '…')
  getProfile(uid).then((p) => {
    pic.replaceWith(avatar(p.photo, p.alias, 36))
    name.textContent = p.alias
  }).catch(() => { name.textContent = '¿?' })
  return h('li', { class: 'person' }, pic, h('div', { class: 'grow' }, name), extra)
}

export function Friends({ onBack }) {
  const { account } = getData()
  const me = account.user.uid
  const other = (f) => f.users.find((u) => u !== me)
  const fs = account.friendships
  const received = fs.filter((f) => f.status === 'pending' && f.to === me)
  const sent = fs.filter((f) => f.status === 'pending' && f.from === me)
  const friends = fs.filter((f) => f.status === 'accepted')
  const relation = new Map(fs.map((f) => [other(f), f]))

  // Buscador por alias
  const results = h('ul', { class: 'people' })
  const input = h('input', { placeholder: 'Buscar por alias', oninput: () => { clearTimeout(timer); timer = setTimeout(search, 300) } })
  let timer
  async function search() {
    const q = input.value.trim()
    if (q.length < 2) { results.replaceChildren(); return }
    try {
      const list = (await searchProfiles(q)).filter((p) => p.uid !== me)
      results.replaceChildren(...list.map((p) => {
        const f = relation.get(p.uid)
        const state = !f ? null : f.status === 'accepted' ? 'Amigos' : f.from === me ? 'Pendiente' : null
        const btn = state
          ? h('small', null, state)
          : h('button', {
              class: 'ghost',
              onclick: async (e) => {
                e.currentTarget.disabled = true
                try { await requestFriend(p.uid); e.target.replaceWith(h('small', null, 'Enviada')) }
                catch (err) { alert(err.message) }
              },
            }, f ? 'Aceptar' : 'Añadir')
        return h('li', { class: 'person' }, avatar(p.photo, p.alias, 36), h('div', { class: 'grow' }, h('b', null, p.alias)), btn)
      }), ...(list.length ? [] : [h('li', { class: 'muted' }, 'Nadie con ese alias')]))
    } catch (e) { results.replaceChildren(h('li', { class: 'error' }, e.message)) }
  }
  onMount(() => input.focus())

  return h('div', { class: 'view' },
    h('header', { class: 'head' }, h('h1', null, h('button', { class: 'back', onclick: onBack }, '‹'), 'Amigos')),
    !account.profile.alias && h('p', { class: 'hint warn' }, 'Ponte un alias en tu perfil para que tus amigos te encuentren.'),

    h('section', { class: 'card' }, h('h3', null, 'Añadir amigo'), input, results),

    received.length > 0 && h('section', { class: 'card' },
      h('h3', null, 'Solicitudes recibidas'),
      h('ul', { class: 'people' }, received.map((f) => person(other(f), h('div', { class: 'row-btns' },
        h('button', { class: 'ghost', onclick: () => removeFriend(f.id) }, 'Rechazar'),
        h('button', { class: 'primary small', onclick: () => acceptFriend(f.id) }, 'Aceptar'),
      )))),
    ),

    h('section', { class: 'card' },
      h('h3', null, `Tus amigos (${friends.length})`),
      friends.length
        ? h('ul', { class: 'people' }, friends.map((f) => person(other(f),
            h('button', { class: 'del', 'aria-label': 'Eliminar', onclick: () => confirm('¿Eliminar de tus amigos?') && removeFriend(f.id) }, '✕'))))
        : h('p', { class: 'hint' }, 'Busca a tus amigos por su alias y envíales una solicitud.'),
    ),

    sent.length > 0 && h('section', { class: 'card' },
      h('h3', null, 'Solicitudes enviadas'),
      h('ul', { class: 'people' }, sent.map((f) => person(other(f),
        h('button', { class: 'ghost', onclick: () => removeFriend(f.id) }, 'Cancelar')))),
    ),
  )
}
