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
      bundleId: shard.meta?.bundles?.map(b => b.id)?.[0]
    })
  }, [shard, session])

  return (
    <Browser
      prefs={prefs}
      session={session}
      shardName={shard?.name}
      shardId={shard.id}
    />
  )
}

export const AnkiStudy = ({ shard }) => {
  const prefs = anki.AnkiPrefsStore()
  const session = AnkiSessionStore(shard.id)

  useEffect(() => {
    if (!shard) return
    session.setState({
      bundleId: shard.meta?.bundles?.map(b => b.id)?.[0]
    })
  }, [shard, session])

  return (
    <StudySession
      prefs={prefs}
      session={session}
    />
  )
}
