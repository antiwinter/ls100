import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Alert } from '@mui/joy'
import { shardApi } from '../shards/shardApi'
import { engineGetReader } from '../shards/engines'
import { log } from '../utils/logger'

export const ShardRouter = () => {
  const { shardId, mode } = useParams()
  const navigate = useNavigate()
  const [shard, setShard] = useState(null)

  // Load shard data (fast local read from IndexedDB)
  useEffect(() => {
    let alive = true

    shardApi.read(shardId).then(data => {
      if (!alive) return
      setShard(data)
      log.debug('ShardRouter loaded shard:', data)
    }).catch(err => {
      log.error('Failed to load shard:', err)
      if (alive) setShard('error')
    })

    return () => {
      alive = false
    }
  }, [shardId])

  // Not loaded yet (should be very fast)
  if (!shard) {
    return null
  }

  // Get reader component for this shard type
  const Reader = engineGetReader(shard?.type)
  if (!Reader) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Invalid shard: {shardId} {shard?.type}
        </Typography>
        <Button onClick={() => navigate(-1)}>
          Go back
        </Button>
      </Box>
    )
  }

  return (
    <Reader
      shard={shard}
      mode={mode}
    />
  )
}
