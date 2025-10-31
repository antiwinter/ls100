import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Overlay } from './Overlay.jsx'
import { log } from '../../utils/logger'

export const useRecordTools = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

      audioChunksRef.current = []
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const recordedDuration = duration

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Reset state
        setIsRecording(false)
        setDuration(0)
        if (timerRef.current) clearInterval(timerRef.current)

        // Notify completion
        onRecordingComplete?.(blob, recordedDuration)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setDuration(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)

    } catch (error) {
      log.error('Failed to start recording:', error)
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Button props for easy binding
  const buttonProps = {
    onMouseDown: startRecording,
    onMouseUp: stopRecording,
    onMouseLeave: stopRecording,
    onTouchStart: startRecording,
    onTouchEnd: stopRecording,
    color: isRecording ? 'danger' : 'primary',
    variant: isRecording ? 'solid' : 'soft'
  }

  // Render overlay via portal
  const overlay = isRecording ? createPortal(
    <Overlay isRecording={isRecording} duration={duration} />,
    document.body
  ) : null

  return {
    buttonProps,
    overlay,
    isRecording
  }
}

