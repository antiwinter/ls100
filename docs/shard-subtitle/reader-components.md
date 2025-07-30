# 1. ActionDrawer

## Purpose
Bottom slide-up drawer containing various learning tools and content.

## Behavior
- **Trigger**: Placeholder tool buttons (word, font, seeker) open this drawer
- **Animation**: Slides up from bottom with smooth transition
- **Dismissal**: Swipe down gesture or click outside drawer area
- **Size**: Configurable via prop (half-screen or full-screen modes)

## Props Interface
```javascript
// ActionDrawer.jsx
{
  open: boolean,           // Control drawer visibility
  onClose: () => void,     // Handle drawer close
  size: 'half' | 'full' | 'fit-content', // Height configuration
  content: React.Node      // Drawer content (word lists, settings, etc.)
}
```
## Content Areas
- **Word Lists**: Selected words from current shard
- **Settings**: Reader preferences (font size, theme, etc.)
- **Progress**: Learning statistics and achievements
- **Tools**: Additional learning features

## Touch Interactions
- **Swipe Down**: Gesture threshold for dismissal
- **Drag Handle**: Visual indicator for swipe interaction
- **Background Tap**: Outside click detection for close

## Styling
- **Material Design**: Consistent with app theme
- **Backdrop**: Semi-transparent overlay
- **Rounded Corners**: Top corners rounded for drawer appearance
- **Z-Index**: Above all other content layers# DictionaryDrawer Component

# 2. DictDrawer

## Purpose
Context-aware dictionary display triggered by word selection.

## Smart Positioning
- **Top Half**: If selected word is in upper half of screen, drawer slides from top
- **Bottom Half**: If selected word is in lower half of screen, drawer slides from bottom
- **Size Limit**: Always less than half screen height to avoid covering word

## Behavior
- **Trigger**: Click on any word in SubtitleViewer
- **Content**: Dictionary definition, translation, pronunciation
- **Dismissal**: Click outside, select another word, or explicit close
- **Position**: Dynamic based on word location

## Props Interface
```javascript
// DictionaryDrawer.jsx
{
  word: string,            // Selected word to look up
  position: 'top' | 'bottom', // Calculated drawer position
  visible: boolean,        // Control drawer visibility
  onClose: () => void,     // Handle drawer close
  onWordSelect: (word) => void // Handle adding word to learning list
}
```

## Position Calculation
```javascript
// Calculate drawer position based on word location
const wordRect = selectedElement.getBoundingClientRect()
const viewportHeight = window.innerHeight
const isUpperHalf = wordRect.top < (viewportHeight / 2)
const position = isUpperHalf ? 'top' : 'bottom'
```

## Content Structure
- **Word**: Selected word with phonetic spelling
- **Definition**: Primary definition from dictionary API
- **Translation**: Target language translation
- **Action**: Add to learning list button
- **Audio**: Pronunciation playback (future)

## Animation
- **Slide In**: Smooth transition from calculated direction
- **Backdrop**: Semi-transparent overlay
- **Spring Physics**: Natural feel for drawer movement
- **Quick Dismissal**: Fast slide out on close# ReaderToolbar Component

# 3. Toolbar
## Purpose
Top slide-down toolbar containing reader navigation and tool buttons.

## Behavior
- **Trigger**: Any click in SubtitleViewer area
- **Animation**: Slides down from top with smooth transition
- **Auto-Hide**: Hides on outside click or timeout
- **Style**: Matches BrowserToolbar.jsx styling patterns

## Props Interface
```javascript
// ReaderToolbar.jsx
{
  visible: boolean,        // Control toolbar visibility
  onBack: () => void,      // Navigation back handler
  onToolSelect: (tool) => void, // Tool button handler
  movieName: string        // Display movie/shard name
}
```

## Tool Buttons
- **Back**: Single `<` icon for navigation (functional)
- **Word**: Feather pen icon - opens ActionDrawer (placeholder)
- **Font**: `A` icon - opens ActionDrawer (placeholder)  
- **Seeker**: Generic icon - opens ActionDrawer (placeholder)

## Layout
- **Left**: Back button + movie name
- **Right**: Tool buttons (word, font, seeker)
- **Spacing**: Consistent with BrowserToolbar spacing
- **Touch Targets**: Minimum 44px for accessibility

## Styling Reference
```javascript
// Follow BrowserToolbar.jsx patterns
sx={{
  position: 'sticky',
  top: 0,
  zIndex: 100,
  bgcolor: 'background.body',
  py: 1,
  px: 2
}}
```

## Auto-Hide Logic
- **Timer**: Hide after 3 seconds of inactivity
- **Outside Click**: Immediate hide on click outside toolbar
- **Tool Interaction**: Keep visible while ActionDrawer is open