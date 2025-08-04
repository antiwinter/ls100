import { extendTheme } from '@mui/joy'

const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        // PRIMARY PALETTE - Teal/Green (from your image)
        primary: {
          50: '#f0fdfa',   // Very light mint
          100: '#ccfbf1',  // Light mint
          200: '#99f6e4',  // Light teal
          300: '#5eead4',  // Medium light teal
          400: '#2dd4bf',  // Medium teal
          500: '#14b8a6',  // Main teal (P marker position)
          600: '#0d9488',  // Dark teal
          700: '#0f766e',  // Darker teal
          800: '#115e59',  // Very dark teal
          900: '#134e4a'  // Darkest teal
        },
        
        // SECONDARY PALETTE - Purple (from your image)
        secondary: {
          50: '#faf5ff',   // Very light lavender
          100: '#f3e8ff',  // Light lavender
          200: '#e9d5ff',  // Light purple
          300: '#d8b4fe',  // Medium light purple
          400: '#c084fc',  // Medium purple
          500: '#a855f7',  // Main purple (S marker position)
          600: '#9333ea',  // Dark purple
          700: '#7c3aed',  // Darker purple
          800: '#6b21b8',  // Very dark purple
          900: '#581c87'  // Darkest purple
        },
        
        // WARNING PALETTE - Golden/Orange (from your image)
        warning: {
          50: '#fffbeb',   // Very light cream
          100: '#fef3c7',  // Light cream
          200: '#fde68a',  // Light yellow
          300: '#fcd34d',  // Medium light yellow
          400: '#fbbf24',  // Medium golden
          500: '#f59e0b',  // Main golden (S marker position)
          600: '#d97706',  // Dark golden
          700: '#b45309',  // Darker orange
          800: '#92400e',  // Dark orange
          900: '#78350f'  // Darkest orange
        }
      }
    },
    dark: {
      palette: {
        // Slightly adjusted for dark mode
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',  // Same main teal
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a'
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',  // Same main purple
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21b8',
          900: '#581c87'
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',  // Same main golden
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f'
        }
      }
    }
  }
})

export default theme 