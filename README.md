# LS100 - Subtitle-Based Language Learning

Learn English through movie subtitles with interactive features and spaced repetition.

## What is LS100?

LS100 is a language learning app that uses movie and TV subtitles to help you learn English naturally. Create learning "shards" from subtitle files, select words you want to learn, and review them with built-in dictionary and spaced repetition features.

## Quick Start

### Prerequisites
- Node.js 22+ 
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ls100

# Install dependencies
yarn install
```

### Development

```bash
# Start both frontend and backend with hot reload
yarn dev
```

- **Frontend**: `http://localhost:5173` - React app with hot reload
- **Backend**: `http://localhost:3001` - API server with auto-restart
- **Mobile testing**: Access via `http://[your-ip]:5173` from mobile devices

### Production

```bash
# Build and start production server
yarn start
```

- Everything runs on `http://localhost:3001` (or $PORT)
- Frontend served as static files from the backend

## How to Use

### 1. Create an Account
- Visit the app and register with your email
- Log in to access your personal learning dashboard

### 2. Create Learning Shards
- Upload SRT subtitle files from your favorite movies/shows
- Give your shard a name and description
- Choose to make it public or keep it private

### 3. Study with Subtitles
- Browse through subtitle lines like reading a script
- Click on words you want to learn
- Get instant dictionary definitions and translations

### 4. Review with Spaced Repetition
- Review selected words with built-in flashcard system
- Track your learning progress over time
- Export cards to external apps like Anki

### 5. Discover Content
- Browse public shards created by other users
- Find content for your skill level and interests

## Mobile Support

LS100 is designed mobile-first with touch-friendly navigation:
- Bottom tab navigation (Home/Explore/Friends/Me)
- Responsive design that works on all screen sizes
- Access from any device with a web browser

## Documentation

For technical details, architecture, and development information:
- **[Development Plan](plan.md)** - Project roadmap and progress
- **[Architecture](docs/design.md)** - Technical design and stack
- **[API Documentation](docs/)** - Module-specific technical docs

## Contributing

See individual module documentation in `docs/` for technical implementation details. 