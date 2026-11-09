export const MUSCLES = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo',
  'Cuádriceps', 'Femoral', 'Glúteo', 'Gemelo', 'Abdomen', 'Lumbar',
]

// key: identificador estable para comparar el mismo ejercicio entre usuarios (rankings)
export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const ex = (name, muscles, bodyweight = false) => ({ name, muscles, bodyweight, key: slug(name) })

export const SEED_EXERCISES = [
  ex('Press banca', ['Pecho', 'Tríceps', 'Hombros']),
  ex('Press inclinado mancuernas', ['Pecho', 'Hombros', 'Tríceps']),
  ex('Aperturas', ['Pecho']),
  ex('Fondos', ['Pecho', 'Tríceps'], true),
  ex('Flexiones', ['Pecho', 'Tríceps'], true),
  ex('Dominadas', ['Espalda', 'Bíceps'], true),
  ex('Jalón al pecho', ['Espalda', 'Bíceps']),
  ex('Remo con barra', ['Espalda', 'Bíceps']),
  ex('Remo en polea', ['Espalda', 'Bíceps']),
  ex('Peso muerto', ['Espalda', 'Femoral', 'Glúteo', 'Lumbar']),
  ex('Press militar', ['Hombros', 'Tríceps']),
  ex('Elevaciones laterales', ['Hombros']),
  ex('Face pull', ['Hombros', 'Espalda']),
  ex('Curl con barra', ['Bíceps', 'Antebrazo']),
  ex('Curl martillo', ['Bíceps', 'Antebrazo']),
  ex('Extensión tríceps polea', ['Tríceps']),
  ex('Press francés', ['Tríceps']),
  ex('Sentadilla', ['Cuádriceps', 'Glúteo', 'Femoral']),
  ex('Prensa', ['Cuádriceps', 'Glúteo']),
  ex('Zancadas', ['Cuádriceps', 'Glúteo']),
  ex('Extensión de cuádriceps', ['Cuádriceps']),
  ex('Curl femoral', ['Femoral']),
  ex('Peso muerto rumano', ['Femoral', 'Glúteo', 'Lumbar']),
  ex('Hip thrust', ['Glúteo', 'Femoral']),
  ex('Elevación de gemelos', ['Gemelo']),
  ex('Crunch', ['Abdomen'], true),
  ex('Plancha', ['Abdomen'], true),
]

const BY_NAME = new Map(SEED_EXERCISES.map((e) => [e.name.toLowerCase(), e.key]))
// Clave de ranking de un ejercicio (los creados por el usuario no tienen)
export const rankKey = (e) => e?.key ?? BY_NAME.get(e?.name?.toLowerCase()) ?? null
