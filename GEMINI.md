# GEMINI Project Context: LS100

## Project Overview

LS100 is a full-stack language learning application designed to help users learn English through movie and TV subtitles. The core concept is the "Shard-Based Architecture," where users create learning "shards" from subtitle files (SRT, VTT, etc.). These shards allow for interactive study, word selection, and review using a built-in dictionary and spaced repetition features.

The application is built with a mobile-first design philosophy and features a modern, responsive user interface.

**Core Technologies:**

*   **Frontend:** React, Vite, Material-UI (MUI), Zustand, Tailwind CSS
*   **Backend:** Node.js, Express.js
*   **Database:** SQLite (with plans for PostgreSQL/MySQL migration)
*   **Package Manager:** Yarn Workspaces

## Architecture

LS100 utilizes a monorepo structure with two main packages: `client` and `server`.

*   **`client`:** A React application built with Vite that serves as the user interface. It handles all user interactions, rendering of subtitle content, and communication with the backend API.
*   **`server`:** An Express.js application that provides a RESTful API for the client. It manages user authentication, data storage, subtitle file processing, and other backend logic.

### Shard-Based Architecture

The central architectural concept is the "shard." A shard is a container for learning content. The initial implementation focuses on "Subtitle Shards," but the architecture is designed to be extensible to other types of shards, such as "Deck Shards" (flashcards) and "Book Shards."

Each shard type has an associated "engine" on both the client and server. This engine encapsulates the logic for processing, displaying, and interacting with that type of content.

### Module System

The application is organized into a series of modules, both on the client and server.

*   **Server Modules:** Located in `server/modules/`, these self-contained modules handle specific features like authentication (`auth`), shard management (`shard`), and subtitle processing (`subtitle`). Each module typically includes its own API routes, data models, and database migration scripts.
*   **Client Modules:** The client-side code is also organized by feature, with components for authentication, shard management, and the various interactive learning modules (Reader, Marker, Dictionary, Cards).

## Getting Started

To set up the development environment, you will need:

*   Node.js (version 22 or higher)
*   Yarn package manager

**Installation:**

1.  Clone the repository.
2.  Install the dependencies from the root directory:
    ```bash
    yarn install
    ```

## Key Commands

The following commands are available in the root `package.json`:

*   **`yarn dev`**: Starts both the client and server in development mode with hot reloading.
    *   Frontend is available at `http://localhost:5173`
    *   Backend is available at `http://localhost:3001`
*   **`yarn start`**: Builds the client for production and starts the production server. The entire application is served from `http://localhost:3001`.
*   **`yarn lint`**: Lints the code in both the `client` and `server` workspaces.
*   **`yarn lint:fix`**: Lints and automatically fixes issues in both workspaces.

## Development Conventions

*   **Coding Style:** JavaScript with ES Modules, no semicolons, and single quotes.
*   **Logging:**
    *   **Backend:** Pino for structured logging and Morgan for HTTP request logging.
    *   **Frontend:** `loglevel` for environment-aware logging.
*   **API Patterns:** A centralized API helper (`client/src/config/api.js`) is used for all API calls. It automatically handles authentication tokens and provides consistent error handling.

## Database

The application uses a SQLite database for data storage. The database schema is managed through migration scripts located in the respective server modules. The database file is located at `server/data/database.sqlite`.

The data storage strategy includes hash-based deduplication for subtitle files to save space.

## Authentication

Authentication is handled using JSON Web Tokens (JWT). The `server/modules/auth/` module contains the logic for user registration, login, and password hashing (using bcrypt). JWT tokens are stored in the client's local storage and are automatically sent with each API request.
