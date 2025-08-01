import { useEffect } from 'react'
import { APP_CONFIG, getAppTitle } from '../config/app'

/**
 * Custom hook to manage page titles dynamically using centralized config
 * @param {string} pageTitle - Optional page-specific title (e.g., "Edit Shard")
 * @param {string} description - Optional page-specific description
 */
export const usePageTitle = (pageTitle = '', description = '') => {
  useEffect(() => {
    // Set title using centralized helper
    document.title = getAppTitle(pageTitle)
    
    // Update meta description if provided
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', description)
      }
    }
    
    // Cleanup: reset to default when component unmounts
    return () => {
      if (pageTitle) {
        document.title = APP_CONFIG.name.full
        const metaDescription = document.querySelector('meta[name="description"]')
        if (metaDescription) {
          metaDescription.setAttribute('content', APP_CONFIG.description.short)
        }
      }
    }
  }, [pageTitle, description])
}

export default usePageTitle