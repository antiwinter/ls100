import { useState, useEffect } from 'react'
import { 
  Box, 
  Stack,
  Modal,
  ModalDialog
} from '@mui/joy'
import { GlobalImport } from '../components/GlobalImport'
import { BrowserToolbar } from '../components/BrowserToolbar'
import { BrowserEditBar } from '../components/BrowserEditBar'
import { ShardBrowser } from '../components/ShardBrowser'
import { SubtitleReader } from '../shards/subtitle'
import { apiCall } from '../config/api'

export const Home = ({ onEditModeChange }) => {
  const [shards, setShards] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [readerShardId, setReaderShardId] = useState(null)
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('shard-sort') || 'last_used'
  })
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState([])

  // Load user's shards
  useEffect(() => {
    loadShards()
  }, [sortBy])

  // Notify parent of edit mode changes
  useEffect(() => {
    onEditModeChange?.(editing)
  }, [editing, onEditModeChange])

  const loadShards = async () => {
    try {
      const data = await apiCall(`/api/shards?sort=${sortBy}`)
      setShards(data.shards || [])
    } catch (error) {
      console.error('Failed to load shards:', error)
    }
  }

  const handleSortChange = (newSort) => {
    setSortBy(newSort)
    localStorage.setItem('shard-sort', newSort)
  }

  const handleImportComplete = (shard) => {
    setShards(prev => [shard, ...prev])
    setShowImport(false)
    setReaderShardId(shard.id)
  }

  const handleOpenReader = (shardId) => {
    setReaderShardId(shardId)
  }

  const handleCloseReader = () => {
    setReaderShardId(null)
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
      console.error('Failed to delete shards:', error)
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
      console.error('Failed to make shards public:', error)
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
      console.error('Failed to make shards private:', error)
    }
  }

  // Show reader if shard selected
  if (readerShardId) {
    return (
      <SubtitleReader 
        shardId={readerShardId} 
        onBack={handleCloseReader}
      />
    )
  }



  return (
    <>
      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)}>
        <ModalDialog sx={{ width: '90vw', maxWidth: 600 }}>
          <GlobalImport
            onComplete={handleImportComplete}
            onCancel={() => setShowImport(false)}
          />
        </ModalDialog>
      </Modal>

      {/* Home Tab Content */}
      <Stack spacing={0}>
        {editing ? (
          <BrowserEditBar 
            selectedCount={selected.length}
            totalCount={shards.length}
            onSelectAll={handleSelectAll}
            onCancel={handleCancelEdit}
            onDelete={handleDelete}
            onMakePublic={handleMakePublic}
            onMakePrivate={handleMakePrivate}
          />
        ) : (
          <BrowserToolbar 
            title="Home"
            onImport={() => setShowImport(true)}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            onSelect={handleStartEdit}
            hasShards={shards.length > 0}
          />
        )}
        <Box sx={{ p: 2 }}>
          <ShardBrowser 
            shards={shards} 
            onOpenShard={handleOpenReader}
            editing={editing}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            onImport={() => setShowImport(true)}
          />
        </Box>
      </Stack>
    </>
  )
}

 