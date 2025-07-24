import { apiCall } from "../../config/api";
import { detectLanguageWithConfidence } from "../../utils/languageDetection";
import { SubtitleShardEditor } from "./SubtitleShardEditor.jsx";
import { SubtitleReader } from "./SubtitleReader.jsx";

// Content detector with confidence scoring
export const detect = (filename, buffer) => {
  const content = buffer.toString("utf8");

  // Check file extension
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename);

  // Check content pattern (timestamps + text)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content);

  // Extract movie info for metadata
  const metadata = parseMovieInfo(filename);

  // For subtitle files, also detect language from content
  if (hasExt || hasPattern) {
    try {
      const langDetection = detectLanguageWithConfidence(content);
      
      // Enhance metadata with detected language (overrides filename-based detection)
      metadata.language = langDetection.language;
      metadata.languageConfidence = langDetection.confidence;
      metadata.textLinesCount = langDetection.textLinesCount;
    } catch (langError) {
      console.warn('Language detection failed:', langError);
      // Keep filename-based language detection as fallback
      metadata.languageConfidence = 0.3;
    }
  }

  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : hasPattern ? 0.7 : 0.0,
    metadata,
  };
};

// Parse movie info from filename (moved from backend)
const parseMovieInfo = (filename) => {
  if (!filename) return { movieName: null, language: null, year: null };

  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Common language patterns (more comprehensive)
  const langPatterns = [
    /\.([a-z]{2})$/i, // .en, .zh, .es
    /\.([a-z]{2}-[A-Z]{2})$/i, // .en-US, .zh-CN, .pt-BR
    /\[([a-z]{2})\]/i, // [en], [zh]
    /\[([a-z]{2}-[A-Z]{2})\]/i, // [en-US], [zh-CN]
    /\b([a-z]{2})\b(?=\.[^/.]*$)/i, // standalone language before extension
  ];

  // Extract language
  let language = null;
  let cleanName = nameWithoutExt;

  for (const pattern of langPatterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      language = match[1].toLowerCase();
      cleanName = nameWithoutExt.replace(pattern, "");
      break;
    }
  }

  // Extract year first as it's a good separator
  const yearMatch = cleanName.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;

  // Smart movie title extraction
  let movieTitle = cleanName;
  
  // If we found a year, take everything before it as the movie title
  if (yearMatch) {
    const yearIndex = cleanName.indexOf(yearMatch[0]);
    movieTitle = cleanName.substring(0, yearIndex);
  } else {
    // If no year, look for common quality indicators and stop there
    const qualityMarkers = /\b(720p|1080p|2160p|4K|BluRay|WEBRip|HDRip|CAMRip|DVDRip|BRRip|WEB-DL|HDTV|REMASTERED|EXTENDED|UNRATED|DIRECTORS?\s*CUT|PROPER|REPACK)\b/i;
    const qualityMatch = movieTitle.match(qualityMarkers);
    if (qualityMatch) {
      const qualityIndex = movieTitle.indexOf(qualityMatch[0]);
      movieTitle = movieTitle.substring(0, qualityIndex);
    }
  }

  // Clean up the movie title
  let movieName = movieTitle
    // Replace dots, underscores, and dashes with spaces
    .replace(/[._-]/g, " ")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize words properly
  movieName = movieName
    .split(" ")
    .filter(word => word.length > 0) // Remove empty words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    movieName: movieName || "Unknown Movie",
    language: language || "en",
    year: year,
  };
};

// Preset color schemes for covers
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple-blue
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink-red
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue-cyan
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green-teal
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'  // Pink-yellow
];

// Smart text formatting for cover titles
const formatCoverText = (title) => {
  if (!title) return '';
  
  const words = title.toUpperCase().split(' ').filter(word => word.length > 0);
  if (words.length === 0) return '';
  
  // For single word, return as is
  if (words.length === 1) {
    return {
      lines: [{ text: words[0], size: 'large' }]
    };
  }
  
  // For two words, put each on separate line
  if (words.length === 2) {
    return {
      lines: [
        { text: words[0], size: 'large' },
        { text: words[1], size: 'large' }
      ]
    };
  }
  
  // For 3+ words, group intelligently
  const lines = [];
  let currentLine = [];
  
  for (const word of words) {
    // If word is very long, put it on its own line with smaller size
    if (word.length > 8) {
      if (currentLine.length > 0) {
        lines.push({ text: currentLine.join(' '), size: 'medium' });
        currentLine = [];
      }
      lines.push({ text: word, size: 'small' });
    } else {
      currentLine.push(word);
      // If we have 2 words or line is getting long, start new line
      if (currentLine.length === 2 || currentLine.join(' ').length > 12) {
        lines.push({ text: currentLine.join(' '), size: currentLine.length === 1 ? 'large' : 'medium' });
        currentLine = [];
      }
    }
  }
  
  // Add remaining words
  if (currentLine.length > 0) {
    lines.push({ text: currentLine.join(' '), size: 'medium' });
  }
  
  return { lines };
};

// Generate text-based cover with improved styling
export const generateCover = (title, identifier = '') => {
  // Use identifier (shard ID or filename) to pick gradient
  // Create a simple hash from the identifier for better distribution
  let hash = 0;
  const str = identifier || title || 'default';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const gradientIndex = Math.abs(hash) % COVER_GRADIENTS.length;
  const gradient = COVER_GRADIENTS[gradientIndex];
  
  // Calculate text color based on background brightness
  const getTextColor = (background) => {
    const colorMatch = background.match(/#([a-f\d]{6})/gi)
    if (!colorMatch) return '#ffffff'
    
    const hex = colorMatch[0].replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 140 ? '#000000' : '#ffffff'
  }
  
  const textColor = getTextColor(gradient)
  const formattedText = formatCoverText(title)
  
  // Add complete styling to each line for consistent rendering across browser and preview
  const styledFormattedText = {
    ...formattedText,
    lines: formattedText.lines.map((line, index) => ({
      ...line,
      styles: {
        fontSize: line.size === 'large' ? '16px' : 
                line.size === 'medium' ? '13px' : '11px',
        fontWeight: 900,
        fontFamily: '"Inter", "Roboto", "Arial Black", sans-serif',
        lineHeight: 0.9,
        color: textColor,
        textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.7)' : '0 1px 2px rgba(255,255,255,0.7)',
        mb: index < formattedText.lines.length - 1 ? 0.3 : 0,
        letterSpacing: '0.5px'
      }
    }))
  }
  
  return {
    type: "text",
    title,
    formattedText: styledFormattedText,
    style: "movie-poster",
    background: gradient,
    textColor: textColor
  };
};

// Generate cover from shard data - subtitle engine knows how to extract relevant info
export const generateCoverFromShard = (shard) => {
  // Subtitle engine knows: use movie_name from subtitles, fallback to shard name
  const movieName = shard.subtitles?.[0]?.movie_name || shard.name;
  const identifier = shard.id?.toString() || movieName;
  
  return generateCover(movieName, identifier);
};

// Get suggested shard name from detected info
export const getSuggestedName = (detectedInfo) => {
  // Subtitle engine knows how to extract movie name from metadata
  return detectedInfo.metadata?.movieName || 
         detectedInfo.metadata?.movie_name || 
         detectedInfo.filename?.replace(/\.[^/.]+$/, '') || 
         'Untitled Shard';
};

// Shard type metadata
export const shardTypeInfo = {
  name: 'subtitle',
  displayName: 'Subtitle Shard',
  color: '#4facfe'
};

// Engine components
export const EditorComponent = SubtitleShardEditor;
export const ReaderComponent = SubtitleReader;

// Create shard with full flow
export const createShard = async (file, user) => {
  // Parse movie info from filename
  const movieInfo = parseMovieInfo(file.name);

  // 1. Upload subtitle file
  const formData = new FormData();
  formData.append("subtitle", file);
  formData.append("movie_name", movieInfo.movieName);
  formData.append("language", movieInfo.language);

  const uploadResult = await apiCall("/api/subtitles/upload", {
    method: "POST",
    body: formData,
  });

  // 2. Create shard with auto-detected metadata
  const { metadata } = uploadResult;
  // Don't save generated cover - only save if user configures URL/upload/poster

  const response = await apiCall("/api/shards", {
    method: "POST",
    body: JSON.stringify({
      name: metadata.movie_name,
      description: `Movie: ${metadata.movie_name} (${metadata.language})`,
      subtitles: [uploadResult.subtitle_id],
      cover_url: null, // Only set when user configures custom cover
      public: false,
    }),
  });

  const shard = response.shard;



  return shard;
};
