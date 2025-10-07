import { useState, useEffect } from 'react'
import { Box, Typography, Alert, Button } from '@mui/joy'
import anki from '../core/index.js'
import { AnkiSessionStore } from '../core/sessionStore.js'
import { AnkiViewer } from './AnkiViewer.jsx'
import { AnkiStudy } from './AnkiStudy.jsx'
import { shardApi } from '../../shardApi.js'
import { log } from '../../../utils/logger'

export const AnkiReader = ({ shardId, onBack }) => {
  const [shard, setShard] = useState(null)
  const [mode, setMode] = useState('view')

  const prefs = anki.AnkiPrefsStore()
  const session = AnkiSessionStore(shardId)

  // Fetch shard and initialize session
  useEffect(() => {
    let alive = true
    shardApi.read(shardId)
      .then(d => {
        if (alive) {
          setShard(d || 'error')
          if (!d) return

          // Initialize session with bundle IDs
          session.setState({
            bundleId: d.meta?.bundles?.map(b => b.id)?.[0]
          })
        }
      })
      .catch((err) => {
        log.error('Failed to load shard:', err)
        if (alive) setShard('error')
      })
    return () => { alive = false }
  }, [shardId, session])

  if (!shard) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="neutral">Loading shard...</Typography>
      </Box>
    )
  }

  if (shard === 'error') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-sm">Failed to load shard</Typography>
          <Button size="sm" variant="outlined" onClick={onBack} sx={{ mt: 1 }}>
            Go back
          </Button>
        </Alert>
      </Box>
    )
  }

  // Route to appropriate mode
  if (mode === 'study') {
    return (
      <AnkiStudy
        prefs={prefs}
        session={session}
        onExit={() => setMode('view')}
      />
    )
  }

  return (
    <AnkiViewer
      prefs={prefs}
      session={session}
      shardName={shard?.name}
      onExit={onBack}
      onStudy={() => setMode('study')}
    />
  )
}
