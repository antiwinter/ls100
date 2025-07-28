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
  getSuggestedName, 
  getShardTypeInfo, 
  getEditorComponent,
  createShardContent,
  processEngineData,
  processShardData
} from '../shards/engines.js'

export const EditShard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get data passed from navigation state
  const { mode = 'create', detectedInfo = null } = location.state || {}
  

  
  // Unified shard data structure for both create and edit modes
  const [shardData, setShardData] = useState({
    name: '',
    description: '',
    shard_data: {}
  })
  const [saving, setSaving] = useState(false)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [showCoverDialog, setShowCoverDialog] = useState(false)

  // Get shard data from navigation or URL
  const navigationShardData = location.state?.shardData
  const shardId = navigationShardData?.id

  useEffect(() => {
    if (mode === 'create' && detectedInfo) {
      // Create mode: use detected metadata for initial name
      const defaultName = detectedInfo?.metadata?.movieName || 
                         detectedInfo?.metadata?.movie_name || 
                         'New Shard'
      
      setShardData({
        name: defaultName,
        description: '',
        shard_data: {}
      })
    } else if (mode === 'edit' && navigationShardData) {
      const fetchShardDetails = async () => {
        try {
          console.log('📝 [EditShard] Edit mode - loading shard details for ID:', shardId)
          const response = await apiCall(`/api/shards/${shardId}`)
          const rawData = response.shard
          console.log('📋 [EditShard] Raw shard data:', rawData)
          
          // Process engine-specific data
          const processedData = processShardData(navigationShardData.type, rawData)
          console.log('🔍 [EditShard] Processed shard data:', processedData)
            
          setShardData({
            name: processedData.name || '',
            description: processedData.description || '',
            shard_data: processedData.shard_data || {}
          })
        } catch (error) {
          console.error('❌ [EditShard] Failed to fetch shard details:', error)
          setShardData({
            name: navigationShardData.name || '',
            description: navigationShardData.description || '',
            shard_data: {}
          })
        }
      }
      
      fetchShardDetails()
    }
  }, [mode, shardId])  // Only re-run if mode or shardId changes

  const handleSave = async () => {
    setSaving(true)
    try {
      console.log('💾 [EditShard] Saving shard data:', shardData)
      
      // Unified create/edit flow using engine-agnostic methods
      const engineType = mode === 'create' ? detectedInfo?.shardType : navigationShardData?.type
      
      if (mode === 'create' && detectedInfo) {
        console.log('🎯 [EditShard] Creating shard via engine:', engineType)
        
        // Let engine handle initial content creation
        const initialContent = await createShardContent(engineType, detectedInfo)
        console.log('📤 [EditShard] Initial content created:', initialContent)
        
        // Process any additional engine data
        const processedData = await processEngineData(engineType, {
          ...shardData.shard_data,
          initialContent
        }, apiCall)
        
        // Create shard with processed data
        const createData = {
          type: engineType,
          name: shardData.name,
          description: shardData.description,
          cover_url: processedData?.cover?.type !== 'generated' ? processedData?.cover?.url : null,
          public: false,
          shard_data: processedData
        }
        
        const shard = await apiCall("/api/shards", {
          method: "POST",
          body: JSON.stringify(createData)
        })
        
        console.log('✅ [EditShard] Shard created:', shard.shard.id)

      } else if (mode === 'edit' && navigationShardData) {
        console.log('📝 [EditShard] Updating shard via engine:', engineType)
        
        // Process engine data using generic method
        const processedData = await processEngineData(engineType, shardData.shard_data, apiCall)
        
        const updateData = {
          name: shardData.name,
          description: shardData.description,
          cover_url: processedData?.cover?.type !== 'generated' ? processedData?.cover?.url : null
        }
        
        if (processedData && Object.keys(processedData).length > 0) {
          updateData.shard_data = processedData
        }
        
        await apiCall(`/api/shards/${shardId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
        
        console.log('✅ [EditShard] Shard updated successfully')
      }
      
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
    // Get type info based on detected type or existing shard
    if (mode === 'create' && detectedInfo) {
      return getShardTypeInfo(detectedInfo.shardType)
    } else if (mode === 'edit' && navigationShardData) {
      return getShardTypeInfo(navigationShardData.type)
    }
    return { displayName: 'Unknown', color: '#666' }
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
                onChange={(e) => setShardData(prev => ({ ...prev, name: e.target.value }))}
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
              const shardType = mode === 'create' ? detectedInfo?.shardType : navigationShardData?.type
              const EditorComponent = getEditorComponent(shardType)
              
              if (!EditorComponent) {
                return (
                  <Typography level="body-sm" color="warning">
                    No editor available for {shardType} shards
                  </Typography>
                )
              }
              
              return (
                <EditorComponent
                  mode={mode}
                  shardData={shardData}
                  detectedInfo={detectedInfo}
                  onChange={(engineData) => setShardData(prev => ({
                    ...prev,
                    shard_data: { ...prev.shard_data, ...engineData }
                  }))}
                  onCoverClick={() => setShowCoverDialog(true)}
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
          disabled={!shardData.name.trim() || (shardData.shard_data.languages && shardData.shard_data.languages.length === 0)}
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
            onChange={(e) => setShardData(prev => ({ ...prev, description: e.target.value }))}
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