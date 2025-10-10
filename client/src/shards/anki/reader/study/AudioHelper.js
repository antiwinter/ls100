// Audio handling utilities for SuperCard

// Handle audio element clicks with play/pause and event management
export const handleAudioClick = (e, containerRef) => {
  const audioWrapper = e?.target?.closest('.anki-audio')
  if (!audioWrapper) return false

  e.stopPropagation()
  const audio = audioWrapper.querySelector('audio')
  if (!audio) return true

  // Set up event handlers once per audio element
  if (!audio.hasAttribute('data-handlers-set')) {
    audio.setAttribute('data-handlers-set', 'true')
    audio.addEventListener('play', () => {
      audioWrapper.classList.add('playing')
    })
    audio.addEventListener('pause', () => {
      audioWrapper.classList.remove('playing')
    })
    audio.addEventListener('ended', () => {
      audioWrapper.classList.remove('playing')
    })
  }

  if (audio.paused) {
    // Pause all other audio elements first
    containerRef.current?.querySelectorAll('.anki-audio').forEach(wrapper => {
      const otherAudio = wrapper.querySelector('audio')
      if (otherAudio && otherAudio !== audio && !otherAudio.paused) {
        otherAudio.pause()
      }
    })
    audio.play()
  } else {
    audio.pause()
  }

  return true
}

// Audio player styling for .anki-audio elements
export const getAudioStyles = () => ({
  '& .anki-audio': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '2px solid black',
    backgroundColor: 'white',
    cursor: 'pointer',
    margin: '8px',
    transition: 'background-color 0.2s ease',

    // Hide the actual audio element completely
    '& audio': {
      display: 'none'
    },

    // Style the play icon span
    '& .play-icon': {
      fontSize: '16px',
      color: 'black',
      lineHeight: 1,
      marginLeft: '2px', // Slight offset for visual centering
      userSelect: 'none'
    },

    // Playing state - much cleaner with wrapper approach
    '&.playing': {
      backgroundColor: 'primary.500',
      '& .play-icon': {
        color: 'white'
      }
    }
  }
})
