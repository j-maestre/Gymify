import Dexie from '../../lib/dexie.js'
import { SEED_EXERCISES } from './seed.js'

// Almacenamiento local (IndexedDB). La app accede a los datos solo a través
// de repo.js, así que migrar a Firebase = reescribir ese archivo.
export const db = new Dexie('gymlog')

db.version(1).stores({
  exercises: '++id, name',
  sets: '++id, exerciseId, date, ts, [exerciseId+date]',
})

db.version(2)
  .stores({
    exercises: '++id, name',          // {name, muscles[], bodyweight}
    sets: '++id, exerciseId, date, ts, [exerciseId+date]', // {exerciseId, reps, weight, warmup, date, ts}
    routines: '++id, name',           // {name, exerciseIds[]}
    sessions: 'date',                 // {date, routineId, exerciseIds[]}
    bodyweight: 'date',               // {date, kg}
  })
  .upgrade((tx) => tx.table('sets').toCollection().modify((s) => { s.warmup ??= false }))

db.on('populate', (tx) => {
  tx.table('exercises').bulkAdd(SEED_EXERCISES)
})
