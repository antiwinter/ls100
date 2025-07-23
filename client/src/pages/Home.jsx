import { useState, useEffect } from 'react'
import { 
  Box, 
  Tabs, 
  TabPanel,
  Typography,
  Card,
  Stack,
  Modal,
  ModalDialog
} from '@mui/joy'
import { useAuth } from '../context/AuthContext'
import { GlobalImport } from '../components/GlobalImport'
import { BrowserToolbar } from '../components/BrowserToolbar'
import { BrowserEditBar } from '../components/BrowserEditBar'
import { BottomNav } from '../components/BottomNav'
import { ShardBrowser } from '../components/ShardBrowser'
import { SubtitleReader } from '../shards/subtitle'
import { Explore } from './Explore'
import { Friends } from './Friends'
import { Me } from './Me'
import { apiCall } from '../config/api'

// Home tab component (inline since it needs shards props)
const HomeTab = ({ 
  shards, 
  onOpenReader, 
  onImport, 
  sortBy, 
  onSortChange,
  editing,
  selected,
  onStartEdit,
  onCancelEdit,
  onToggleSelect,
  onSelectAll,
  onDelete,
  onMakePublic,
  onMakePrivate
}) => {
  return (
    <Stack spacing={0}>
      {editing ? (
        <BrowserEditBar 
          selectedCount={selected.length}
          totalCount={shards.length}
          onSelectAll={onSelectAll}
          onCancel={onCancelEdit}
          onDelete={onDelete}
          onMakePublic={onMakePublic}
          onMakePrivate={onMakePrivate}
        />
      ) : (
        <BrowserToolbar 
          title="Home"
          onImport={onImport}
          sortBy={sortBy}
          onSortChange={onSortChange}
          onSelect={onStartEdit}
          hasShards={shards.length > 0}
        />
      )}
      <Box sx={{ p: 2 }}>
        <ShardBrowser 
          shards={shards} 
          onOpenShard={onOpenReader}
          editing={editing}
          selected={selected}
          onToggleSelect={onToggleSelect}
          onImport={onImport}
        />
      </Box>
    </Stack>
  )
}

const Home = () => {
  const [activeTab, setActiveTab] = useState(0)
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
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body'
    }}>
      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)}>
        <ModalDialog sx={{ width: '90vw', maxWidth: 600 }}>
          <GlobalImport
            onComplete={handleImportComplete}
            onCancel={() => setShowImport(false)}
          />
        </ModalDialog>
      </Modal>

      {/* Main content area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        pb: 10 // Space for bottom navigation
      }}>
        <Tabs 
          value={activeTab} 
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ height: '100%' }}
        >
          {/* Content panels */}
          <TabPanel value={0} sx={{ p: 0 }}>
            <HomeTab 
              shards={shards}
              onOpenReader={handleOpenReader}
              onImport={() => setShowImport(true)}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              editing={editing}
              selected={selected}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onDelete={handleDelete}
              onMakePublic={handleMakePublic}
              onMakePrivate={handleMakePrivate}
            />
          </TabPanel>
          <TabPanel value={1} sx={{ p: 2 }}>
            <Explore />
          </TabPanel>
          <TabPanel value={2} sx={{ p: 2 }}>
            <Friends />
          </TabPanel>
          <TabPanel value={3} sx={{ p: 2 }}>
            <Me />
          </TabPanel>
        </Tabs>
      </Box>

      {/* Bottom Navigation */}
      {!editing && (
        <BottomNav 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </Box>
  )
}

export default Home 