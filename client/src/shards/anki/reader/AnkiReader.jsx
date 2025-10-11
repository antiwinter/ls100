import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box } from '@mui/joy'
import anki from '../core/index.js'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { Browser } from './browse/index.jsx'
import { StudySession } from './study/index.jsx'

export const AnkiReader = ({ shard, mode = 'view' }) => {
  const navigate = useNavigate()
  const prefs = anki.AnkiPrefsStore()
  const session = AnkiSessionStore(shard.id)

  // Initialize session with bundle IDs
  useEffect(() => {
    if (!shard) return

    session.setState({
      bundleId: shard.meta?.bundles?.map(b => b.id)?.[0]
    })
  }, [shard, session])

  // Route to appropriate mode
  if (mode === 'study') {
    return (
      <StudySession
        prefs={prefs}
        session={session}
        onExit={() => navigate(-1)}
      />
    )
  }

  return (
    <Browser
      prefs={prefs}
      session={session}
      shardName={shard?.name}
      onExit={() => navigate(-1)}
      onStudy={() => navigate(`/shard/${shard.id}/study`)}
    />
  )
}
