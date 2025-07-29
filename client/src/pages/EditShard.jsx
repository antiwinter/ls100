import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Box, 
  Typography, 
  Stack, 
  Input, 
  Textarea, 
  Button,
  Chip,
  IconButton,
  Link
} from '@mui/joy'
import { ArrowBack, Upload, Link as LinkIcon } from '@mui/icons-material'
import { AppDialog } from '../components/AppDialog'
import { apiCall } from '../config/api'
import { 
  engineGetTag, 
  engineGetEditor,
  engineSaveData
} from '../shards/engines.js'

export const EditShard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get data passed from navigation state
  const { mode = 'create', detectedInfo = null } = location.state || {}
  

  
  // Unified shard data structure for both create and edit modes
  const [shardData, _setShardData] = useState({
    name: '',
    description: '',
    cover: null,
    data: {}
  })

  // Helper to normalize shard data with fallbacks
  const setShardData = (shard) => {
    _setShardData({
      name: shard.name || '',
      description: shard.description || '',
      cover: shard.cover || null,
      type: shard.type || null,
      public: shard.public !== undefined ? shard.public : false, // Default to private
      data: shard.data || {}
    })
  }
  const [saving, setSaving] = useState(false)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [showCoverDialog, setShowCoverDialog] = useState(false)

  // Get shard data from navigation or URL
  const navigationShardData = location.state?.shardData
  const shardId = navigationShardData?.id

  useEffect(() => {
    if (mode === 'create' && detectedInfo) {
      // Create mode: initialize with detected info (engine will process)
      const defaultName = detectedInfo?.metadata?.suggestedName || 
                         detectedInfo?.filename?.replace(/\.[^/.]+$/, '') || 
                         'New Shard'
      
      setShardData({
        name: defaultName,
        description: '',
        type: detectedInfo.shardType,
        public: false, // Default to private
        data: {
          initialFile: detectedInfo // Let engine handle this properly
        }
      })
    } else if (mode === 'edit' && navigationShardData) {
      const fetchShardDetails = async () => {
        try {
          console.log('📝 [EditShard] Edit mode - loading shard details for ID:', shardId)
          const response = await apiCall(`/api/shards/${shardId}`)
        
        // Backend now returns unified format directly
        const shard = response.shard
          console.log('🔍 [EditShard] Processed shard data:', shard)
            
          setShardData(shard)
        } catch (error) {
          console.error('❌ [EditShard] Failed to fetch shard details:', error)
          setShardData(navigationShardData)
        }
      }
      
      fetchShardDetails()
    }
  }, [mode, shardId])  // Only re-run if mode or shardId changes

  const handleSave = async () => {
    setSaving(true)
    try {
      console.log('💾 [EditShard] Saving shard data:', shardData)
      
      const isCreate = mode === 'create'
      
      console.log(`📝 [EditShard] ${isCreate ? 'Creating' : 'Updating'} shard:`, shardData.type)
      
      // Process uploads and prepare shardData for backend
      await engineSaveData(shardData, apiCall)
      
      // Submit shardData directly
      const result = await apiCall(
        isCreate ? "/api/shards" : `/api/shards/${shardId}`,
        {
          method: isCreate ? "POST" : "PUT",
          body: JSON.stringify(shardData)
        }
      )
      
      console.log(`✅ [EditShard] Shard ${isCreate ? 'created' : 'updated'}:`, 
        isCreate ? result.shard.id : shardId)
      
      // Navigate back to home
      navigate('/')
    } catch (error) {
      console.error('Failed to save shard:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  const getShardTypeDisplayInfo = () => {
    // Get type info from current shardData
    return shardData.type ? engineGetTag(shardData.type) : { displayName: 'Unknown', color: '#666' }
  }

  const shardTypeInfo = getShardTypeDisplayInfo()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.body' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.surface'
      }}>
        <IconButton
          variant="outlined"
          color="neutral"
          size="sm"
          onClick={handleBack}
          sx={{ borderRadius: '50%' }}
        >
          <ArrowBack />
        </IconButton>
        <Typography level="h3" sx={{ fontWeight: 'bold' }}>
          {mode === 'create' ? 'Create a Shard' : 'Edit Shard'}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ 
        maxWidth: 600, 
        mx: 'auto', 
        p: 3,
        pb: 8,  // Extra bottom padding for mobile
        overflowX: 'hidden'  // Hide horizontal scroll
      }}>
        <Stack spacing={3}>
          {/* Generic Shard Configuration */}
          <Stack spacing={2}>
            {/* Shard Name with Type Tag and Description */}
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                  Name
                </Typography>
                <Chip 
                  variant="soft"
                  size="sm"
                  sx={{ 
                    bgcolor: `${shardTypeInfo.color}15`,
                    color: shardTypeInfo.color,
                    fontWeight: 'medium'
                  }}
                >
                  {shardTypeInfo.displayName}
                </Chip>
              </Stack>
              <Input
                value={shardData.name}
                onChange={(e) => _setShardData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter shard name"
                size="sm"
                sx={{ mb: 0.5 }}
              />
              {/* Description - tightly coupled with name input */}
              {shardData.description ? (
                <Typography level="body-sm" component="div">
                  {shardData.description}{' '}
                  <Link 
                    component="button"
                    level="body-sm" 
                    onClick={() => setShowDescriptionDialog(true)}
                  >
                    edit
                  </Link>
                </Typography>
              ) : (
                <Link 
                  component="button"
                  level="body-sm" 
                  onClick={() => setShowDescriptionDialog(true)}
                >
                  Add description
                </Link>
              )}
            </Box>
          </Stack>

          {/* Shard-Specific Configuration */}
          <Box>
            {(() => {
              const EditorComponent = engineGetEditor(shardData.type)
              
              if (!EditorComponent) {
                return (
                  <Typography level="body-sm" color="warning">
                    No editor available for {shardData.type} shards
                  </Typography>
                )
              }
              
              return (
                <EditorComponent
                  mode={mode}
                  shardData={shardData}
                  detectedInfo={detectedInfo}
                  onChange={(engineData) => _setShardData(prev => ({
                    ...prev,
                    data: { ...prev.data, ...engineData }
                  }))}
                />
              )
            })()}
          </Box>
        </Stack>
      </Box>

      {/* Fixed Action Bar */}
      <Box sx={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        p: 2,
        bgcolor: 'background.surface',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2
      }}>
        <Button 
          variant="outlined" 
          size="sm" 
          onClick={handleBack}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button 
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={!shardData.name.trim() || (shardData.data.languages && shardData.data.languages.length === 0)}
        >
          {mode === 'create' ? 'Create Shard' : 'Save Changes'}
        </Button>
      </Box>

      {/* Description Dialog */}
      <AppDialog
        open={showDescriptionDialog}
        onClose={() => setShowDescriptionDialog(false)}
        title="Shard Description"
        maxWidth={500}
      >
        <Stack spacing={2}>
          <Textarea
            value={shardData.description}
            onChange={(e) => _setShardData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe this learning content..."
            minRows={3}
            maxRows={6}
            size="sm"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="sm" 
              onClick={() => setShowDescriptionDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowDescriptionDialog(false)}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </AppDialog>

      {/* Cover Dialog */}
      <AppDialog
        open={showCoverDialog}
        onClose={() => setShowCoverDialog(false)}
        title="Cover Image"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm">
            Upload a custom image or provide a URL for the shard cover.
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<Upload />}
              sx={{ flex: 1 }}
            >
              Upload Image
            </Button>
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<LinkIcon />}
              sx={{ flex: 1 }}
            >
              Use URL
            </Button>
          </Stack>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="sm" 
              onClick={() => setShowCoverDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowCoverDialog(false)}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </AppDialog>
    </Box>
  )
} 