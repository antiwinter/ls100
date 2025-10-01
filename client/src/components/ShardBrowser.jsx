import {
  Box,
  Typography,
  Card,
  Grid,
  IconButton
} from '@mui/joy'
import { CheckCircle, RadioButtonUnchecked, Add } from '@mui/icons-material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMask } from '@fortawesome/free-solid-svg-icons'
import { engineGenCover } from '../shards/engines.js'
import { useLongPress } from '../utils/useLongPress.js'

// Empty state component
const EmptyState = ({ onImport }) => (
  <Box sx={{
    textAlign: 'center',
    py: 12,
    px: 4
  }}>
    <Box
      onClick={onImport}
      sx={{
        width: 80,
        height: 80,
        mx: 'auto',
        mb: 3,
        border: 'neutral.500',
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.level1',
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': {
          opacity: 0.8
        }
      }}
    >
      <Add sx={{
        fontSize: 32,
        color: '#D1D5DB'
      }} />
    </Box>
    <Typography
      level="body-md"
      sx={{
        color: '#9CA3AF',
        fontSize: '0.95rem',
        lineHeight: 1.6,
        maxWidth: 280,
        mx: 'auto'
      }}
    >
      <strong>Import</strong> learning materials or visit the <strong>Explore</strong> tab to
      discover content and get started
    </Typography>
  </Box>
)

// Individual shard item component
const ShardItem = ({
  shard, index, isSelected, editing, onToggleSelect, onOpenShard, onStartEdit
}) => {
  // Long press handlers for this shard
  const handlePress = (e, type) => {
    const select = () => onToggleSelect(shard.id)
    if (type === 'long') {
      if (!editing) {
        onStartEdit?.()
        setTimeout(select, 0)
      } else {
        select()
      }
      return
    }
    if (editing) select()
    else onOpenShard(shard.id)
  }

  const longPressHandlers = useLongPress(handlePress)

  return (
    <Grid
      key={shard.id || `shard-${index}`}
      xs={4}
      sm={3}
      md={2.4}
      lg={2}
      xl={1.7}
      sx={{
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <Card
        sx={{
          p: 0,
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
          border: 'none',
          boxShadow: 'none',
          bgcolor: 'transparent',
          width: '100%',
          maxWidth: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          ...(!editing && {
            '&:hover': {
              transform: 'translateY(-2px)'
            }
          })
        }}
      >
        {/* Cover */}
        <Box
          {...longPressHandlers.handlers}
          sx={{
            width: '100%',
            height: 100,
            borderRadius: 8,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {editing && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 1
              }}
            >
              {isSelected ? (
                <CheckCircle sx={{ color: 'white', fontSize: 20 }} />
              ) : (
                <RadioButtonUnchecked sx={{ color: 'white', fontSize: 20 }} />
              )}
            </Box>
          )}

          {!shard.public && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 4,
                left: 6,
                zIndex: 1,
                color: 'black'
              }}
            >
              <FontAwesomeIcon icon={faMask} style={{ fontSize: 14 }} />
            </Box>
          )}

          {shard.cover ? (
            <img
              src={`/oss/${shard.cover}`}
              alt={`${shard.name} cover`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            engineGenCover(shard)
          )}
        </Box>

        {/* Info */}
        <Typography
          level="body-sm"
          sx={{
            fontWeight: 'md',
            fontSize: '0.65rem',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            px: 1,
            mt: 0.5,
            color: 'text.secondary',
            userSelect: 'none'
          }}
        >
          {shard.name}
        </Typography>
      </Card>
    </Grid>
  )
}

export const ShardBrowser = ({
  shards, onOpenShard, editing, selected = [], onToggleSelect, onImport, onStartEdit
}) => {
  if (shards.length === 0) {
    return <EmptyState onImport={onImport} />
  }

  return (
    <Box sx={{
      maxWidth: 800,
      mx: 'auto',
      px: 2,
      pt: 1.5
    }}>
      <Grid container rowSpacing={3.5} columnSpacing={1.5}>
        {shards.map((shard, index) => {
          const isSelected = selected.includes(shard.id)

          return (
            <ShardItem
              key={shard.id || `shard-${index}`}
              shard={shard}
              index={index}
              isSelected={isSelected}
              editing={editing}
              onToggleSelect={onToggleSelect}
              onOpenShard={onOpenShard}
              onStartEdit={onStartEdit}
            />
          )
        })}
      </Grid>
    </Box>
  )
}
