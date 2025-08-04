import { useState, useEffect, useRef } from 'react'
import { usePageTitle } from '../utils/usePageTitle'
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
import { log } from '../utils/logger'
import { apiCall } from '../config/api'
import { 
  engineGetTag, 
  engineGetEditor,
  engineSaveData,
  engineGenCover
} from '../shards/engines.js'


export const EditShard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  
  // Get data passed from navigation state
  const { mode = 'create', detectedInfo = null } = location.state || {}
  
  // Set dynamic page title based on mode
  usePageTitle(
    mode === 'create' ? 'Create Shard' : 'Edit Shard',
    mode === 'create' 
      ? 'Create a new learning shard from your content'
      : 'Edit your learning shard settings and content'
  )
  
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
  const [coverUrl, setCoverUrl] = useState('')

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
        data: {} // Keep empty, let editor initialize from detectedInfo
      })
    } else if (mode === 'edit' && navigationShardData) {
      const fetchShardDetails = async () => {
        try {
          log.info('📝 Edit mode - loading shard details for ID:', shardId)
          const response = await apiCall(`/api/shards/${shardId}`)
        
        // Backend now returns unified format directly
        const shard = response.shard
          log.info('🔍 Processed shard data:', shard)
            
          setShardData(shard)
        } catch (error) {
          log.error('❌ Failed to fetch shard details:', error)
          setShardData(navigationShardData)
        }
      }
      
      fetchShardDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, shardId])  // Only re-run if mode or shardId changes

  const handleSave = async () => {
    setSaving(true)
    try {
      log.info('💾 Saving shard data:', shardData)
      
      const isCreate = mode === 'create'
      
      log.info(`📝 ${isCreate ? 'Creating' : 'Updating'} shard:`, shardData.type)
      
      // Handle cover file upload if needed
      if (shardData.coverFile) {
        const formData = new FormData()
        formData.append('cover', shardData.coverFile)
        
        const uploadResult = await apiCall('/api/files/upload', {
          method: 'POST',
          body: formData
        })
        
        // Replace file with URL
        shardData.cover = uploadResult.url
        delete shardData.coverFile
      }
      
      // Process uploads and prepare shardData for backend
      await engineSaveData(shardData, apiCall)
      
      // Submit shardData directly
      const result = await apiCall(
        isCreate ? '/api/shards' : `/api/shards/${shardId}`,
        {
          method: isCreate ? 'POST' : 'PUT',
          body: JSON.stringify(shardData)
        }
      )
      
      log.info(`✅ Shard ${isCreate ? 'created' : 'updated'}:`, 
        isCreate ? result.shard.id : shardId)
      
      // Navigate back to home
      navigate('/')
    } catch (error) {
      log.error('Failed to save shard:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    _setShardData(prev => ({ ...prev, cover: url, coverFile: file }))
    setShowCoverDialog(false)
  }

  const handleCoverUrl = () => {
    if (coverUrl.trim()) {
      _setShardData(prev => ({ ...prev, cover: coverUrl.trim() }))
      setCoverUrl('')
      setShowCoverDialog(false)
    }
  }

  const resetCover = () => {
    _setShardData(prev => ({ ...prev, cover: null, coverFile: null }))
    setShowCoverDialog(false)
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

          {/* Cover Preview */}
          <Box>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
              Preview
            </Typography>
            <Box
              sx={{
                width: 90,
                height: 100,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider'
              }}
              onClick={() => setShowCoverDialog(true)}
            >
              {shardData.cover ? (
                <img
                  src={shardData.cover}
                  alt="Cover preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              ) : (
                (() => {
                  if (!shardData.type) {
                    return (
                      <Box sx={{ 
                        fontSize: '11px', 
                        color: 'text.tertiary',
                        textAlign: 'center'
                      }}>
                        No Preview
                      </Box>
                    )
                  }
                  
                  const cover = engineGenCover(shardData)
                  
                  return (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        background: cover.background,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: cover.textColor,
                        textAlign: 'center',
                        p: 1,
                        borderRadius: 8,
                        lineHeight: 1
                      }}
                    >
                      {cover.formattedText?.lines ? 
                        cover.formattedText.lines.map((line, index) => (
                          <Box
                            key={index}
                            sx={line.styles || {
                              fontSize: '11px',
                              fontWeight: 900,
                              fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                              lineHeight: 0.9,
                              color: cover.textColor,
                              textShadow: cover.textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                              mb: index < cover.formattedText.lines.length - 1 ? 0.2 : 0,
                              letterSpacing: '0.3px'
                            }}
                          >
                            {line.text}
                          </Box>
                        )) :
                        <Box sx={{ 
                          fontSize: '11px', 
                          fontWeight: 900,
                          fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
                          color: cover.textColor,
                          textShadow: cover.textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
                          letterSpacing: '0.3px'
                        }}>
                          {cover.title?.toUpperCase() || 'SHARD'}
                        </Box>
                      }
                    </Box>
                  )
                })()
              )}
            </Box>
          </Box>

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
        title="Shard Cover"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm">
            Upload an image or paste a URL for your shard cover
          </Typography>
          
          <Stack spacing={1}>
            <Button
              startDecorator={<Upload />}
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Image
            </Button>
            
            <Stack direction="row" spacing={1}>
              <Input
                placeholder="Or paste image URL..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                size="sm"
                sx={{ flex: 1 }}
              />
              <Button
                size="sm"
                startDecorator={<LinkIcon />}
                onClick={handleCoverUrl}
                disabled={!coverUrl.trim()}
              >
                Set
              </Button>
            </Stack>
            
            {shardData.cover && (
              <Button
                variant="outlined"
                color="danger"
                size="sm"
                onClick={resetCover}
              >
                Reset to Generated
              </Button>
            )}
          </Stack>
        </Stack>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCoverUpload}
        />
      </AppDialog>
    </Box>
  )
} 