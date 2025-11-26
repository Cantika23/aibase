# AI Base - Agent Guidelines

## Development Commands

### Frontend (React + Vite)
- `bun run dev` - Start development server
- `bun run build` - Build for production (runs TypeScript check + Vite build)
- `bun run lint` - Run ESLint
- `bun run preview` - Preview production build

### Backend (Bun + TypeScript)
- `bun run src/server/index.ts` - Start backend server
- `bun run start` - Start backend server (alias)

## Code Style Guidelines

### TypeScript Configuration
- Strict mode enabled with `noUncheckedIndexedAccess`, `noImplicitOverride`
- ESNext target with React JSX
- Path aliases: `@/*` maps to `./src/*` in frontend

### Import Style
- Use absolute imports with `@/` prefix for internal modules
- Group imports: React libraries first, then external packages, then internal modules
- Example: `import { useState } from "react"; import { WSClient } from "@/lib/ws/ws-client";`

### Component Patterns
- Use shadcn/ui components with class-variance-authority (CVA)
- Utility function `cn()` for className merging (clsx + tailwind-merge)
- Forward refs and compound component patterns for UI components

### Error Handling
- Use try-catch blocks with proper error typing
- Return error states in hooks (error: string | null)
- Handle WebSocket errors with specific error message types

### Naming Conventions
- Components: PascalCase (Button, ChatInterface)
- Hooks: camelCase with `use` prefix (useChat, useAudioRecording)
- Functions: camelCase, descriptive names
- Constants: UPPER_SNAKE_CASE for exports

### File Organization
- Components in `src/components/` with feature-based folders
- Hooks in `src/hooks/`
- Utilities in `src/lib/`
- Types in `src/lib/types/`

### WebSocket Architecture
- Real-time communication using custom WSClient/WServer classes
- Event-driven architecture with typed message handling
- Connection state management with reconnection logic