import { useState, useEffect } from 'react'
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
import { apiCall } from '../config/api'
import { engineGetReader } from '../shards/engines.js'
import { log } from '../utils/logger'

export const Home = ({ onEditModeChange, onReaderModeChange }) => {
  const navigate = useNavigate()
  const [shards, setShards] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [readerShard, setReaderShard] = useState(null)
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('shard-sort') || 'last_used'
  })
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState([])

  // Load user's shards on mount and when sort changes
  useEffect(() => {
    loadShards()
  }, [sortBy]) // Will run on mount (initial sortBy) and when sortBy changes

  // Notify parent of edit mode changes
  useEffect(() => {
    onEditModeChange?.(editing)
  }, [editing, onEditModeChange])

  // Notify parent of reader mode changes
  useEffect(() => {
    onReaderModeChange?.(!!readerShard)
  }, [readerShard, onReaderModeChange])

  const loadShards = async () => {
    try {
      const data = await apiCall(`/api/shards?sort=${sortBy}`)
      setShards(data.shards || [])
    } catch (error) {
      log.error('Failed to load shards:', error)
    }
  }

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    localStorage.setItem('shard-sort', newSort)
  }

  const handleImportConfigure = (info) => {

    setShowImport(false)
    
    // Create a clean version of detectedInfo without functions
    const cleanDetectedInfo = {
      file: info.file,
      shardType: info.shardType,
      metadata: info.metadata,
      filename: info.filename,
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
      await Promise.all(selected.map(id => apiCall(`/api/shards/${id}`, { method: 'DELETE' })))
      const data = await apiCall(`/api/shards?sort=${sortBy}`)
      const updatedShards = data.shards || []
      setShards(updatedShards)
      
      // Check if all shards were deleted
      if (updatedShards.length === 0) {
        // Last shard deleted - exit edit mode and return to home
        setEditing(false)
      }
      
      setSelected([])
    } catch (error) {
      log.error('Failed to delete shards:', error)
    }
  }

  const handleMakePublic = async () => {
    if (selected.length === 0) return
    
    try {
      await Promise.all(selected.map(id => 
        apiCall(`/api/shards/${id}`, { 
          method: 'PUT',
          body: JSON.stringify({ public: true })
        })
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
        apiCall(`/api/shards/${id}`, { 
          method: 'PUT',
          body: JSON.stringify({ public: false })
        })
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
        title="Select Learning Content"
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

 