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
import { HeaderToolbar } from '../components/HeaderToolbar'
import { BottomNav } from '../components/BottomNav'
import { ShardBrowser } from '../components/ShardBrowser'
import { SubtitleReader } from '../shards/subtitle'
import { Explore } from './Explore'
import { Friends } from './Friends'
import { Me } from './Me'
import { apiCall } from '../config/api'

// Home tab component (inline since it needs shards props)
const HomeTab = ({ shards, onOpenReader }) => {
  const { user } = useAuth()
  
  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <ShardBrowser 
          shards={shards} 
          onOpenShard={onOpenReader}
        />
      </Card>
    </Stack>
  )
}

const Home = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [shards, setShards] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [readerShardId, setReaderShardId] = useState(null)

  // Load user's shards
  useEffect(() => {
    loadShards()
  }, [])

  const loadShards = async () => {
    try {
      const data = await apiCall('/api/shards')
      setShards(data.shards || [])
    } catch (error) {
      console.error('Failed to load shards:', error)
    }
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

  // Show reader if shard selected
  if (readerShardId) {
    return (
      <SubtitleReader 
        shardId={readerShardId} 
        onBack={handleCloseReader}
      />
    )
  }

  const getTabTitle = () => {
    const titles = ['Home', 'Explore', 'Friends', 'Profile']
    return titles[activeTab] || 'LS100'
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

      {/* Header */}
      <HeaderToolbar 
        title={getTabTitle()}
        onImport={() => setShowImport(true)}
      />

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
          <TabPanel value={0} sx={{ p: 2 }}>
            <HomeTab 
              shards={shards}
              onOpenReader={handleOpenReader}
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
      <BottomNav 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </Box>
  )
}

export default Home 