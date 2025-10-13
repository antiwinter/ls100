import { useEffect } from 'react'
import anki from '../core/index.js'
import { Browser } from './browse/index.jsx'
import { StudySession } from './study/index.jsx'

export const AnkiReader = ({ shard, mode }) => {
  const session = anki.sessionStore(shard.id)
  const _prefs = anki.prefsStore(shard.id)
  const { globalPrefs } = _prefs()
  const prefs = globalPrefs ? anki.prefsStore() : _prefs

  useEffect(() => {
    if (!shard) return
    session.setState({
      shard,
      bundleId: shard.meta?.bundles?.[0]?.id
    })
  }, [shard, session])

  return (
    mode === 'study' ?
      <StudySession
        prefs={prefs}
        session={session}
      /> :
      <Browser
        prefs={prefs}
        session={session}
      />
  )
}
