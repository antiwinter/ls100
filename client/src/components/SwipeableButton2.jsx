import React from 'react'
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions
} from 'react-swipeable-list'
import 'react-swipeable-list/dist/styles.css'
import { Box } from '@mui/joy'

export const SwipeableButton2 = ({
  children,
  actions = [],
  onClick,
  maxSwipe = 140,
  threshold = 60
}) => {
  // Use standard threshold values that work well with the library
  // Convert our actions array to TrailingActions component
  const trailingActions = () => (
    <TrailingActions>
      {/* {actions.map((action, index) => (
        <SwipeAction
          key={index}
          destructive={action.color === 'danger'}
          onClick={() => action.action?.()}
          style={{
            backgroundColor: getActionColor(action.color),
            color: 'white',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minWidth: `${maxSwipe / actions.length}px`,
            width: `${maxSwipe / actions.length}px`,
            height: '100%',
            border: 'none',
            borderRadius: 0,
            padding: '8px',
            cursor: 'pointer',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            width: '100%'
          }}>
            {action.name}
          </span>
        </SwipeAction>
      ))} */}
    </TrailingActions>
  )

  return (
    <Box
    //   sx={{
    //     position: 'relative',
    //     overflow: 'hidden',
    //     bgcolor: 'background.surface',
    //     borderRadius: 'sm',
    //     // Override react-swipeable-list default styles
    //     '& .swipe-action': {
    //       borderRadius: '0 !important',
    //       border: 'none !important',
    //       padding: '0 !important',
    //       margin: '0 !important',
    //       height: '100% !important',
    //       display: 'flex !important',
    //       alignItems: 'center !important',
    //       justifyContent: 'center !important',
    //       textAlign: 'center !important'
    //     },
    //     '& .swipeable-list': {
    //       backgroundColor: 'transparent !important',
    //       padding: '0 !important',
    //       margin: '0 !important'
    //     },
    //     '& .swipeable-list-item': {
    //       borderRadius: 'sm',
    //       backgroundColor: 'transparent !important',
    //       border: 'none !important',
    //       padding: '0 !important',
    //       margin: '0 !important'
    //     },
    //     '& .swipeable-list-item__content': {
    //       backgroundColor: 'var(--joy-palette-background-surface) !important',
    //       borderRadius: 'var(--joy-radius-sm) !important'
    //     },
    //     '& .swipeable-list-item__leading-actions': {
    //       height: '100% !important'
    //     },
    //     '& .swipeable-list-item__trailing-actions': {
    //       height: '100% !important',
    //       display: 'flex !important'
    //     }
    //   }}
    >
      <SwipeableList
        // type="IOS"
        // threshold={0.3}
        // fullSwipe={false}
        // destructiveCallbackDelay={1000}
        // style={{
        //   backgroundColor: 'transparent'
        // }}
      >
        <SwipeableListItem
          trailingActions={actions.length > 0 ? trailingActions() : undefined}
          onClick={onClick}
          style={{
            backgroundColor: 'var(--joy-palette-background-surface)',
            borderRadius: 'var(--joy-radius-sm)'
          }}
        >
          <Box sx={{
            p: 2,
            userSelect: 'none',
            bgcolor: 'background.surface',
            borderRadius: 'sm',
            cursor: 'pointer'
          }}>
            {children}
          </Box>
        </SwipeableListItem>
      </SwipeableList>
    </Box>
  )
}

// Helper function to map our color names to Joy UI theme colors
const getActionColor = (color) => {
  const colorMap = {
    danger: '#c41e3a',    // Joy UI danger.500
    warning: '#f57c00',   // Joy UI warning.500
    neutral: '#555e68',   // Joy UI neutral.500
    primary: '#0b6bcb',   // Joy UI primary.500
    success: '#1a7a1a'    // Joy UI success.500
  }
  return colorMap[color] || colorMap.neutral
}
