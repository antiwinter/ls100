Anki toolbar implementation in shards/anki/overlay

* exactly same style as src/components/overlay/Toolbar.jsx
* similar way to use an OverlayManager to hook the tools
* similar way to implement tools using ActionDrawer
* MAKE SURE to component style unified with the subtitle shard

# AnkiViewer:
[Back -------  STUDY STATISTICS SEARCH SETTINGS]

## STUDY: 
launch study session
## STATISTICS: 
lanuch a full height drawer from bottom. content set to some placeholder.
## SEARCH: 
short drawer from bottom, fuzzy search any note fields. Viewer dynamicly filter according to search results
## SETTINGS: 
multi-page drawer
### Browse options:
previewSide: 'both', 'front', 'back'
### Learning options:
      // STUDY OPTIONS
      maxNewCards: 18,
      maxReviewCards: 188,
      dailyResetTime: 4, // in hours
      // New cards only graduate out of current session when next due is beyond this gap (minutes)
      gradGap: 10,

      // Accessibility
      autoReveal: false,
      autoPlayAudio: true,

      // Study Flow
      newReviewOrder: 'mixed',  // 'mixed' | 'new-first' | 'review-first'
      // New card ordering
      newCardOrder: 'gather',   // 'gather' | 'random' | 'template-random'
      // Anki behavior
      autoBurySiblings: true,   // Hide sibling cards from same note during queue building
      naturalCooldown: false,   // Use natural cooldown instead of daily reset

# AnkiViewer:
[Back -------  UNDO EDIT SESSION CARD]
## UNDO: 
undo, disabled on empty actions[]
## EDIT: 
full height drawer, edit note fields
## SESSION: 
session summary:
[  |  ||  ||  ||] a spectrum chart show session time
learning progress
learning status

operations:
Reset session: reset all rating done by this session, reset all sesstion status, restart
Rebuild session: keep any progress. rebuild the session, restart.

### Current card
Show card fsrs status,
Show card forgetting curve chart.

operations:
bury: remove from session queue
suspend: mark card as suspend