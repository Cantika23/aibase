# Extension Documentation

## Overview

Extensions in AIBase are modular, project-scoped plugins that extend the LLM's capabilities. They can provide custom script functions, file processing, and custom UI components loaded from the backend using a plugin architecture.

### Backend Plugin Architecture (Production)

AIBase uses a **full backend plugin system** where all extension UI components are loaded dynamically from the backend:

```
Frontend (window.libs)          Backend Extension UI
├── React                      └── show-chart/ui.tsx
├── ReactDOM                       ├── show-table/ui.tsx
├── echarts                       └── show-mermaid/ui.tsx
├── ReactECharts
└── mermaid
```

**Key Concepts:**

1. **Backend Bundling**: Extension UI files are bundled with esbuild on-demand
2. **External Dependencies**: React and visualization libraries are loaded in frontend and exposed via `window.libs`
3. **Dynamic Loading**: Frontend fetches bundled UI from `/api/extensions/:id/ui`
4. **Priority System**: Project-specific UI overrides global defaults

### Development vs Production Mode

| Mode | Environment Variable | Source Location | Use Case |
|------|---------------------|-----------------|----------|
| Development | `USE_DEFAULT_EXTENSIONS=true` | `backend/src/tools/extensions/defaults/` | Hot-reload during development |
| Production | `USE_DEFAULT_EXTENSIONS=false` (default) | `data/{projectId}/extensions/` | Per-project customization, deployment |

## Extension Structure

An extension consists of the following files:

```
my-extension/
├── metadata.json    # Extension metadata (required)
├── index.ts         # TypeScript implementation (required)
└── ui.tsx          # React UI components (optional)
```

### metadata.json

Required metadata file describing the extension:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Brief description of what it does",
  "author": "Your Name",
  "version": "1.0.0",
  "category": "my-category",
  "enabled": true,
  "isDefault": false,
  "createdAt": 1704067200000,
  "updatedAt": 1704067200000
}
```

### index.ts

TypeScript implementation. Must export a default object with functions:

```typescript
const myExtension = {
  myFunction: async (options: { param: string }) => {
    return { result: `Hello ${options.param}` };
  }
};
return myExtension; // Required return statement
```

### ui.tsx (Optional)

React components for custom UI. Loaded from backend and uses `window.libs` for dependencies.

## Priority System for Extension UI

Extension UI components are loaded with a priority system:

### 1. Project-Specific Extensions (Highest Priority)

```
data/{projectId}/extensions/{extensionId}/ui.tsx
```

Custom UI for a specific project. Overrides global default.

**Example:**
```typescript
// data/project-A/extensions/show-chart/ui.tsx
export default function ShowChartInspector({ data }) {
  // Custom dark theme for project A
  return <div className="custom-dark">{/* ... */}</div>;
}
```

### 2. Global Default Extensions (Fallback)

```
backend/src/tools/extensions/defaults/{extensionId}/ui.tsx
```

Default UI used when no project-specific override exists.

**Example:**
```typescript
// backend/src/tools/extensions/defaults/show-chart/ui.tsx
export default function ShowChartInspector({ data }) {
  // Standard chart UI
  return <div className="chart">{/* ... */}</div>;
}
```

### Loading Priority

When loading UI for extension `show-chart` in `project-A`:

1. Check: `data/project-A/extensions/show-chart/ui.tsx`
2. If exists → Use project-specific UI
3. If not → Use `backend/src/tools/extensions/defaults/show-chart/ui.tsx`

### API Endpoint

```typescript
// Default UI (global)
GET /api/extensions/show-chart/ui

// Project-specific UI
GET /api/extensions/show-chart/ui?projectId=project-A&tenantId=1
```

## Backend Plugin System

### window.libs Architecture

Frontend pre-loads shared libraries to `window.libs` before loading extension UI:

```typescript
// frontend/src/main.tsx
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import mermaid from 'mermaid';

if (typeof window !== 'undefined') {
  (window as any).libs = {
    React,
    ReactDOM: { createRoot },
    echarts,
    ReactECharts,
    mermaid,
  };
}
```

### Extension UI Using window.libs

Extension UI components access libraries from `window.libs`:

```typescript
// backend/src/tools/extensions/defaults/show-chart/ui.tsx

// Get ReactECharts from window.libs
declare const window: {
  libs: {
    React: any;
    ReactDOM: any;
    ReactECharts: any;
    echarts: any;
    mermaid: any;
  };
};

const ReactECharts = window.libs.ReactECharts;

export default function ShowChartInspector({ data }) {
  return (
    <div>
      <ReactECharts option={chartOption} />
    </div>
  );
}
```

### esbuild Configuration

Backend uses esbuild with external dependencies:

```typescript
// backend/src/server/extension-ui-handler.ts
const result = await esbuild.build({
  entryPoints: [uiPath],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  format: 'esm',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'echarts',
    'echarts-for-react',
    'mermaid'
  ],  // Exclude shared deps - loaded from frontend window.libs
  write: false,
});
```

## Custom UI Components

Extensions provide React components for two contexts:

### Component Types

#### 1. Inspector Component (Default Export)

Full-featured UI for the inspection dialog:

```typescript
// ui.tsx
export default function MyExtensionInspector({ data, error }: InspectorProps) {
  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">
        <h4 className="font-semibold mb-2">Error</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h4 className="font-semibold">Results</h4>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

#### 2. Message Component (Named Export)

Simplified UI for inline chat messages:

```typescript
// ui.tsx
export function MyExtensionMessage({ toolInvocation }: MessageProps) {
  const { result } = toolInvocation;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      {/* Simplified inline UI */}
    </div>
  );
}
```

### Naming Convention

Component names follow extension ID naming:

| Extension ID | Inspector (default) | Message (named) |
|--------------|---------------------|-----------------|
| `show-chart` | `ShowChartInspector` | `ShowChartMessage` |
| `image-search` | `ImageSearchInspector` | `ImageSearchMessage` |
| `my-extension` | `MyExtensionInspector` | `MyExtensionMessage` |

Pattern: `{ExtensionId}` → `{PascalCaseId}Inspector` / `{PascalCaseId}Message`

### TypeScript Interfaces

```typescript
// Inspector props (default export)
interface InspectorProps {
  data?: {
    [key: string]: any;  // Extension-specific data
  };
  error?: string;
}

// Message props (named export)
interface MessageProps {
  toolInvocation: {
    toolCallId: string;
    result: {
      [key: string]: any;
    };
  };
}
```

## Using Visualization Libraries

### ECharts (show-chart)

```typescript
declare const window: {
  libs: {
    React: any;
    ReactECharts: any;
    echarts: any;
  };
};

const ReactECharts = window.libs.ReactECharts;

export function ShowChartMessage({ toolInvocation }) {
  const { series, xAxis } = toolInvocation.result.args;

  const option = {
    xAxis: { type: 'category', data: xAxis },
    series: [{ type: 'bar', data: series }]
  };

  return (
    <div className="h-[300px]">
      <ReactECharts option={option} />
    </div>
  );
}
```

### Mermaid (show-mermaid)

```typescript
const mermaid = window.libs.mermaid;

export function ShowMermaidMessage({ toolInvocation }) {
  const { code } = toolInvocation.result.args;

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false });
    mermaid.render('mermaid-diagram', code);
  }, [code]);

  return <div id="mermaid-diagram" />;
}
```

## Metadata Reference

Complete reference of all `ExtensionMetadata` properties:

### Basic Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (kebab-case, matches folder name) |
| `name` | `string` | Yes | Display name shown in UI |
| `description` | `string` | Yes | What the extension does |
| `author` | `string` | No | Who created it |
| `version` | `string` | Yes | Semantic version (e.g., "1.0.0") |
| `category` | `string` | No | Category ID for grouping (e.g., "database-tools") |
| `enabled` | `boolean` | Yes | Whether the extension is active |
| `isDefault` | `boolean` | Yes | Whether it came from defaults |
| `createdAt` | `number` | Yes | Unix timestamp in milliseconds |
| `updatedAt` | `number` | Yes | Unix timestamp in milliseconds |

### Advanced Properties

#### examples: `ExampleEntry[]`

Rich examples for LLM context. Format:

```typescript
interface ExampleEntry {
  title: string;          // Example title
  description?: string;   // Optional description
  code: string;           // TypeScript code example
  result?: string;        // Optional result description
}
```

#### fileExtraction: `FileExtractionConfig`

Declare support for automatic file processing:

```typescript
interface FileExtractionConfig {
  supportedTypes: string[];      // File extensions: ['pdf', 'docx', 'xlsx']
  outputFormat: 'markdown' | 'text';
}
```

#### messageUI: `MessageUIConfig` (DEPRECATED)

UI components are now auto-discovered from `ui.tsx` exports. This field is no longer needed.

#### inspectionUI: `InspectionUIConfig` (DEPRECATED)

UI components are now auto-discovered from `ui.tsx` exports. This field is no longer needed.

## Core Features

### Script Functions

Define callable functions in the exported object. They become available to the LLM in script execution:

```typescript
const myExtension = {
  // Single function - flattened to top-level scope
  query: async (options: { sql: string }) => {
    return { results: [] };
  },

  // Multiple functions - use namespace
  query: async (options) => { /* ... */ },
  connect: async (options) => { /* ... */ }
};
```

**Namespace behavior** (kebab-case to camelCase):
- Single function: `my-extension` → `myExtension()`
- Multiple functions: `my-extension` → `myExtension.query()`, `myExtension.connect()`

### Context Generation

The `context()` function generates AI documentation. Two approaches:

#### 1. Custom Context (Recommended)

Export a `context()` function for full control:

```typescript
const context = () => `
### My Extension

Query CSV files using SQL.

#### myExtension.query(options)
Execute SQL query.

\`\`\`typescript
await myExtension.query({
  sql: "SELECT * FROM 'data.csv' LIMIT 10"
});
\`\`\`

**Parameters:**
- \`sql\` (required): SQL query string

**Returns:**
- \`data\`: Result rows
- \`rowCount\`: Number of rows
`;
```

#### 2. Auto-Generated Context

If no `context()` is exported, AIBase analyzes the code:
- Extracts function signatures
- Parses parameters and return types
- Generates basic usage examples

### Hook System

Register callbacks for events using the hook registry:

```typescript
// Access hook registry from global argument
const myExtension = {
  myFunction: async (options) => { /* ... */ }
};

// Register hook (must be before return statement)
if (typeof extensionHookRegistry !== 'undefined') {
  extensionHookRegistry.registerHook(
    'afterFileUpload',
    'my-extension',
    async (context) => {
      const { fileName, filePath, fileType } = context;
      // Process file...
      return { description: 'Processed successfully' };
    }
  );
}

return myExtension;
```

#### Hook Types

| Hook Type | Context Interface | Description |
|-----------|-------------------|-------------|
| `afterFileUpload` | `FileUploadContext` | Called after file upload |

## UI Caching and Performance

### Cache Strategy

Extension UI is cached with ETag support:

```typescript
// First request
GET /api/extensions/show-chart/ui
→ 200 OK + ETag: "abc123..."

// Subsequent requests
GET /api/extensions/show-chart/ui
→ 304 Not Modified (if cached)

// Forced refresh
GET /api/extensions/show-chart/ui
→ Returns fresh content if source changed
```

### Cache Invalidation

Cache is invalidated when:
- Source file (`ui.tsx`) is modified (mtime-based)
- Manually cleared via `clearBackendComponentCache()`
- Server restart (in-memory cache cleared)

## Examples

### Database Tools

- **duckdb**: Query CSV, Excel, Parquet, JSON with SQL
- **postgresql**: PostgreSQL queries with connection pooling
- **clickhouse**: ClickHouse analytics database
- **trino**: Distributed SQL queries

All include inspection UI showing query results, execution time, and database-specific stats.

### Document Processing

- **pdf-document**: PDF text extraction
- **excel-document**: Excel file processing
- **word-document**: Word document text extraction
- **powerpoint-document**: PowerPoint presentation extraction
- **image-document**: Image analysis with vision models (needs UI)

### Visualization

- **show-chart**: Interactive charts (bar, line, pie, scatter) using ECharts
- **show-table**: Data table display
- **show-mermaid**: Mermaid diagram rendering
- **peek**: Quick data inspection with pagination

### Web Tools

- **web-search**: Web search functionality with Brave API
- **image-search**: Image search with thumbnails

## Development Workflow

### Creating a New Extension

1. **Create directory** in `backend/src/tools/extensions/defaults/my-extension/`

2. **Write metadata.json**:
```bash
backend/src/tools/extensions/defaults/my-extension/metadata.json
```

3. **Write index.ts**:
```typescript
const context = () => `### My Extension\n...`;

const myExtension = {
  myFunction: async (options) => {
    return { result: 'success' };
  }
};

return myExtension;
```

4. **Write ui.tsx** (optional):
```typescript
export default function MyExtensionInspector({ data, error }) {
  // Inspector UI
}

export function MyExtensionMessage({ toolInvocation }) {
  // Message UI
}
```

5. **Test in development mode**:
```bash
USE_DEFAULT_EXTENSIONS=true bun run backend/src/server/index.ts
```

### Testing Extension UI

1. Start backend with `USE_DEFAULT_EXTENSIONS=true`
2. Create a new conversation
3. Call extension function:
```typescript
const result = await myExtension.myFunction({ param: 'value' });
return result;
```
4. Click on result to open inspection dialog
5. Verify custom UI renders correctly

### Deployment

For production, extensions are copied to `data/{projectId}/extensions/`:

```bash
# Automatic on first project access
# Manual reset via API
POST /api/projects/{projectId}/extensions/reset
```

## API Endpoints

### Extension Management

#### List Extensions
```
GET /api/projects/{projectId}/extensions
```
Returns all extensions for a project.

#### Get Extension
```
GET /api/projects/{projectId}/extensions/{extensionId}
```
Returns a specific extension.

#### Create Extension
```
POST /api/projects/{projectId}/extensions
```
Body:
```json
{
  "id": "my-extension",
  "name": "My Extension",
  "description": "Description",
  "code": "const ext = { ... }; return ext;",
  "category": "my-category",
  "enabled": true
}
```

#### Update Extension
```
PUT /api/projects/{projectId}/extensions/{extensionId}
```
Body: Same as create (all fields optional).

#### Delete Extension
```
DELETE /api/projects/{projectId}/extensions/{extensionId}
```

#### Toggle Extension
```
POST /api/projects/{projectId}/extensions/{extensionId}/toggle
```
Toggles the `enabled` state.

#### Reset to Defaults
```
POST /api/projects/{projectId}/extensions/reset
```
Deletes all project extensions and copies defaults.

### Extension UI

#### Get Extension UI
```
GET /api/extensions/{extensionId}/ui
GET /api/extensions/{extensionId}/ui?projectId={projectId}&tenantId={tenantId}
```
Returns bundled React component code.

**Response:**
- Content-Type: `application/javascript; charset=utf-8`
- ETag header for caching
- 304 Not Modified if cached

## Best Practices

### Extension Development

1. **Namespace design**: Use kebab-case IDs (`my-extension`) that become camelCase namespaces (`myExtension`)
2. **Error handling**: Always throw descriptive `Error` objects
3. **Type safety**: Define TypeScript interfaces for options/returns
4. **Context quality**: Provide rich `context()` for better LLM usage
5. **Hook cleanup**: Hooks automatically cleaned up on extension unload

### UI Development

1. **Use window.libs**: Always access React/ECharts/Mermaid from `window.libs`
2. **Dual exports**: Provide both Inspector (default) and Message (named) components
3. **Naming**: Follow `{ExtensionId}Inspector` / `{ExtensionId}Message` pattern
4. **Error states**: Handle `error` prop gracefully
5. **Loading states**: Show loading indicators for async operations
6. **Responsive**: Use Tailwind classes for responsive design
7. **Dark mode**: Support both light and dark themes

### Performance

1. **Lazy loading**: Message UI should be lightweight
2. **Caching**: Leverage backend UI caching
3. **Pre-bundling**: Server pre-bundles UI on startup for faster first load
4. **External deps**: Never bundle React/viz libs - use window.libs

## Key Files Referenced

- **`extension-loader.ts`**: Loading, compiling, executing extensions
- **`extension-context.ts`**: AI context generation from metadata and code
- **`extension-hooks.ts`**: Hook system implementation
- **`extension-storage.ts`**: Storage layer (metadata, code persistence)
- **`extension-ui-handler.ts`**: UI bundling and serving with esbuild
- **`defaults/*/`**: Example extension implementations
- **`../../server/extensions-handler.ts`**: REST API endpoints
- **`frontend/src/main.tsx`**: window.libs initialization
- **`frontend/src/components/ui/chat/tools/extension-component-registry.tsx`**: Dynamic component loading
