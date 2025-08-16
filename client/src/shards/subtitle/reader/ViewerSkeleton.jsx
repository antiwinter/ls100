import React from 'react'
import { Box, Stack, Skeleton } from '@mui/joy'

// Simple, pleasant skeleton for the subtitle viewer area
// Fills the available space and hints at time column + text rows
export default function ViewerSkeleton() {
  const rows = Array.from({ length: 12 })
  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
      {/* <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Skeleton variant="rectangular" width={96} height={16} animation="wave" />
        <Skeleton variant="rectangular" width={64} height={16} animation="wave" />
      </Stack> */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((_, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            <Skeleton variant="rectangular" width={40} height={12} animation="wave" />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="rectangular" height={12} sx={{ mb: 0.5, width: `${95 - (i % 2) * 10}%` }} animation="wave" />
              {/* <Skeleton variant="rectangular" height={12}
                  sx={{ mb: 0.5, width: `80%` }} animation="wave" /> */}
              {/* <Skeleton variant="rectangular" height={12}
                  sx={{ width: `${60 + (i % 2) * 10}%` }} animation="wave" /> */}
            </Box>
          </Stack>
        ))}
      </Box>
    </Box>
  )
}


