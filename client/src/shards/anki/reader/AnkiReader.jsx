import { useEffect } from 'react'
import anki from '../core/index.js'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { Browser } from './browse/index.jsx'
import { StudySession } from './study/index.jsx'

export const AnkiBrowser = ({ shard }) => {
  const prefs = anki.AnkiPrefsStore()
  const session = AnkiSessionStore(shard.id)

  useEffect(() => {
    if (!shard) return
    session.setState({
      shard,
      bundleId: shard.meta?.bundles?.[0]?.id
    })
  }, [shard, session])

  return (
    <Browser
      prefs={prefs}
      session={session}
    />
  )
}

export const AnkiStudy = ({ shard }) => {
  const prefs = anki.AnkiPrefsStore()
  const session = AnkiSessionStore(shard.id)

  useEffect(() => {
    if (!shard) return
    session.setState({
      bundleId: shard.meta?.bundles?.[0]?.id
    })
  }, [shard, session])

  return (
    <StudySession
      prefs={prefs}
      session={session}
    />
  )
}
