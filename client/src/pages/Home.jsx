import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Stack,
  Button,
  Typography
} from '@mui/joy'
import { GlobalImport } from '../components/GlobalImport'
import { BrowserToolbar } from '../components/BrowserToolbar'
import { BrowserEditBar } from '../components/BrowserEditBar'
import { ShardBrowser } from '../components/ShardBrowser'
import { AppDialog } from '../components/AppDialog'
import { shardDb } from '../shards/store'
import { engineGetReader, engineCleanup } from '../shards/engines.js'
import { log } from '../utils/logger'
import { APP } from '../config/constants'

export const Home = ({ onEditModeChange, onReaderModeChange }) => {
  const navigate = useNavigate()
  const [shards, setShards] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [readerShard, setReaderShard] = useState(null)
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem(APP.storage.sort) || 'last_used'
  })
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState([])

  const loadShards = useCallback(async () => {
    try {
      // Clean up abandoned drafts first
      await shardDb.cleanup()

      // Load from local store with BE fallback
      const allShards = await shardDb.list({ sort: sortBy })

      // Sort locally
      const sorted = sortShards(allShards, sortBy)
      setShards(sorted)
    } catch (error) {
      log.error('Failed to load shards:', error)
    }
  }, [sortBy])

  // Local sorting function
  const sortShards = (shards, sortBy) => {
    const sorted = [...shards]

    switch (sortBy) {
    case 'last_used':
      return sorted.sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
      )
    case 'name':
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    case 'created':
      return sorted.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )
    default:
      return sorted
    }
  }

  // Load user's shards on mount and when sort changes
  useEffect(() => {
    loadShards()
  }, [loadShards])

  // Notify parent of edit mode changes
  useEffect(() => {
    onEditModeChange?.(editing)
  }, [editing, onEditModeChange])

  // Notify parent of reader mode changes
  useEffect(() => {
    onReaderModeChange?.(!!readerShard)
  }, [readerShard, onReaderModeChange])

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    localStorage.setItem(APP.storage.sort, newSort)
  }

  const handleImportConfigure = (info) => {

    setShowImport(false)

    // Create a clean version of detectedInfo without functions
    const cleanDetectedInfo = {
      file: info.file,
      shardType: info.shardType,
      metadata: info.metadata,
      filename: info.filename
      // Don't pass processor (contains functions)
    }

    navigate('/edit-shard', {
      state: {
        mode: 'create',
        detectedInfo: cleanDetectedInfo
      }
    })
  }



  const handleOpenReader = (shardId) => {
    const shard = shards.find(s => s.id === shardId)
    setReaderShard(shard)
  }

  const handleCloseReader = () => {
    setReaderShard(null)
  }

  // Selection handlers
  const handleStartEdit = () => {
    setEditing(true)
    setSelected([])
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setSelected([])
  }

  const handleToggleSelect = (shardId) => {
    setSelected(prev =>
      prev.includes(shardId)
        ? prev.filter(id => id !== shardId)
        : [...prev, shardId]
    )
  }

  const handleSelectAll = () => {
    const allSelected = selected.length === shards.length
    setSelected(allSelected ? [] : shards.map(s => s.id))
  }

  const handleDelete = async () => {
    if (selected.length === 0) return

    try {
      // Get full shard objects for the selected IDs
      const shardsToDelete = shards.filter(shard => selected.includes(shard.id))

      // Call engine cleanup for each shard BEFORE deleting
      log.info('Cleaning up engine data for shards:', shardsToDelete.map(s => ({ id: s.id, type: s.type })))
      await Promise.all(shardsToDelete.map(shard => engineCleanup(shard, shards)))

      // Delete from local store (also deletes from BE if has oldId)
      await Promise.all(selected.map(id => shardDb.delete(id)))

      // Reload shards
      await loadShards()

      // Check if all shards were deleted
      const remainingShards = shards.filter(s => !selected.includes(s.id))
      if (remainingShards.length === 0) {
        setEditing(false)
      }

      setSelected([])
      log.info('Shard deletion completed successfully')
    } catch (error) {
      log.error('Failed to delete shards:', error)
    }
  }

  const handleMakePublic = async () => {
    if (selected.length === 0) return

    try {
      await Promise.all(selected.map(id =>
        shardDb.update(id, { public: true })
      ))
      await loadShards()
    } catch (error) {
      log.error('Failed to make shards public:', error)
    }
  }

  const handleMakePrivate = async () => {
    if (selected.length === 0) return

    try {
      await Promise.all(selected.map(id =>
        shardDb.update(id, { public: false })
      ))
      await loadShards()
    } catch (error) {
      log.error('Failed to make shards private:', error)
    }
  }

  const handleEdit = () => {
    if (selected.length !== 1) return

    const shardId = selected[0]
    const shard = shards.find(s => s.id === shardId)

    if (!shard) return

    navigate('/edit-shard', {
      state: {
        mode: 'edit',
        shardData: shard
      }
    })
  }

  // Show reader if shard selected
  if (readerShard) {
    const ReaderComponent = engineGetReader(readerShard.type)

    if (!ReaderComponent) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography level="h4" sx={{ mb: 2 }}>
            No reader available for {readerShard.type} shards
          </Typography>
          <Button onClick={handleCloseReader}>
            Back to Home
          </Button>
        </Box>
      )
    }

    return (
      <ReaderComponent
        shardId={readerShard.id}
        onBack={handleCloseReader}
      />
    )
  }



  return (
    <>
      {/* Import Dialog */}
      <AppDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import anything"
        maxWidth={500}
      >
        <GlobalImport
          onConfigure={handleImportConfigure}
          onCancel={() => setShowImport(false)}
        />
      </AppDialog>

      {/* Home Tab Content */}
      <Stack spacing={0}>
        {editing ? (
          <BrowserEditBar
            selectedCount={selected.length}
            totalCount={shards.length}
            selectedShards={shards.filter(s => selected.includes(s.id))}
            onSelectAll={handleSelectAll}
            onCancel={handleCancelEdit}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onMakePublic={handleMakePublic}
            onMakePrivate={handleMakePrivate}
          />
        ) : (
          <>
            <BrowserToolbar
              title="Home"
              onImport={() => setShowImport(true)}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              onSelect={handleStartEdit}
              hasShards={shards.length > 0}
            />
          </>
        )}
        <Box sx={{ p: 2 }}>
          <ShardBrowser
            shards={shards}
            onOpenShard={handleOpenReader}
            editing={editing}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            onImport={() => setShowImport(true)}
            onStartEdit={handleStartEdit}
          />
        </Box>
      </Stack>
    </>
  )
}

