# Extension Documentation

## Overview

Extensions in AIBase are modular, project-scoped plugins that extend the LLM's capabilities. They can provide custom script functions, file processing, and custom UI components.

### How Extensions Work

1. **Loading**: Extensions are loaded when a conversation starts via `ExtensionLoader.loadExtensions()`
2. **Execution**: Extension functions are available to the LLM as tools in the script execution context
3. **Context**: Extensions generate AI context documentation via `context()` function or automatic code analysis
4. **Hooks**: Extensions can register callbacks for events like `afterFileUpload`

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

React components for custom UI. See "Custom UI Components" section below.

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

```json
{
  "examples": [
    {
      "title": "Query a CSV file",
      "description": "Select rows from a CSV file",
      "code": "await myExtension.query({ file: 'data.csv' });",
      "result": "Returns first 10 rows"
    }
  ]
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

```json
{
  "fileExtraction": {
    "supportedTypes": ["pdf", "docx"],
    "outputFormat": "markdown"
  }
}
```

#### messageUI: `MessageUIConfig`

Custom UI component for rendering in chat messages:

```typescript
interface MessageUIConfig {
  componentName: string;          // React component name (e.g., "MyExtensionMessage")
  visualizationType: string;      // Type for __visualizations (e.g., "my-extension")
  uiFile?: string;                // UI filename (default: "ui.tsx")
}
```

```json
{
  "messageUI": {
    "componentName": "DuckDBMessage",
    "visualizationType": "duckdb"
  }
}
```

#### inspectionUI: `InspectionUIConfig`

Custom UI for the inspection dialog:

```typescript
interface InspectionUIConfig {
  tabLabel: string;               // Tab label (e.g., "Query Details")
  componentName: string;          // React component name (e.g., "DuckDBInspector")
  uiFile?: string;                // UI filename (default: "ui.tsx")
  showByDefault?: boolean;        // Auto-select this tab
}
```

```json
{
  "inspectionUI": {
    "tabLabel": "Query Details",
    "componentName": "DuckDBInspector",
    "showByDefault": true
  }
}
```

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

#### FileUploadContext

```typescript
interface FileUploadContext {
  convId: string;       // Conversation ID
  projectId: string;    // Project ID
  fileName: string;     // Original filename
  filePath: string;     // Full file path
  fileType: string;     // MIME type
  fileSize: number;     // File size in bytes
}
```

Return `{ description: string }` to provide AI context about the file.

### File Processing

Extensions can declare support for automatic file extraction via `fileExtraction` metadata. When combined with `afterFileUpload` hooks, files are automatically processed on upload.

Example from `image-document` extension:

```typescript
// metadata.json
{
  "fileExtraction": {
    "supportedTypes": ["png", "jpg", "jpeg", "gif", "webp"],
    "outputFormat": "markdown"
  }
}

// index.ts
if (typeof extensionHookRegistry !== 'undefined') {
  extensionHookRegistry.registerHook(
    'afterFileUpload',
    'image-document',
    async (context) => {
      if (!isImageFile(context.fileType)) return;

      const description = await analyzeImageFile(context.filePath, context.fileType);
      return { description };
    }
  );
}
```

### Custom UI Components

Extensions can provide React components for two contexts:

#### 1. Message UI (Inline Chat)

Renders in chat messages when `__visualization` is returned:

```typescript
// index.ts
const myExtension = {
  showChart: async (options: ChartOptions) => {
    return {
      __visualization: {
        type: "show-chart",  // Must match messageUI.visualizationType
        toolCallId: `call_${Date.now()}`,
        args: options
      }
    };
  }
};
```

```tsx
// ui.tsx - Message component (named export)
export function ShowChartMessage({ toolInvocation }: MessageProps) {
  const { args } = toolInvocation.result.__visualization;
  return <div>{/* Render chart */}</div>;
}
```

#### 2. Inspection UI (Dialog)

Renders in a tab of the inspection dialog:

```tsx
// ui.tsx - Inspector component (default export)
export default function MyInspector({ data, error }: InspectorProps) {
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <div>No data</div>;

  return (
    <div>
      <h4>Result</h4>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

#### UI TypeScript Interfaces

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
      __visualization?: {
        type: string;
        toolCallId: string;
        args: any;
      };
      [key: string]: any;
    };
  };
}
```

## TypeScript Interfaces

Complete type definitions from `extension-storage.ts`:

```typescript
export interface ExampleEntry {
  title: string;
  description?: string;
  code: string;
  result?: string;
}

export interface FileExtractionConfig {
  supportedTypes: string[];
  outputFormat: 'markdown' | 'text';
}

export interface MessageUIConfig {
  componentName: string;
  visualizationType: string;
  uiFile?: string;
}

export interface InspectionUIConfig {
  tabLabel: string;
  componentName: string;
  uiFile?: string;
  showByDefault?: boolean;
}

export interface ExtensionMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  category: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;

  // Optional advanced metadata
  examples?: ExampleEntry[];
  fileExtraction?: FileExtractionConfig;
  messageUI?: MessageUIConfig;
  inspectionUI?: InspectionUIConfig;
}

export interface Extension {
  metadata: ExtensionMetadata;
  code: string;
}

export interface CreateExtensionData {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  category?: string;
  code: string;
  enabled?: boolean;
  isDefault?: boolean;
  examples?: ExampleEntry[];
  fileExtraction?: FileExtractionConfig;
  messageUI?: MessageUIConfig;
  inspectionUI?: InspectionUIConfig;
}
```

## Examples

### Database Tools

- **duckdb**: Query CSV, Excel, Parquet, JSON with SQL (`backend/src/tools/extensions/defaults/duckdb/`)
- **postgresql**: PostgreSQL queries with connection pooling
- **clickhouse**: ClickHouse analytics database
- **trino**: Distributed SQL queries

### Document Processing

- **pdf-document**: PDF text extraction (`backend/src/tools/extensions/defaults/pdf-document/`)
- **excel-document**: Excel file processing
- **word-document**: Word document text extraction
- **powerpoint-document**: PowerPoint presentation extraction
- **image-document**: Image analysis with vision models

### Visualization

- **show-chart**: Interactive charts (bar, line, pie, scatter)
- **show-table**: Data table display
- **show-mermaid**: Mermaid diagram rendering
- **peek**: Quick data inspection

### Web Tools

- **web-search**: Web search functionality
- **image-search**: Image search capabilities

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

4. **Test in development mode**:
```bash
USE_DEFAULT_EXTENSIONS=true bun run backend/src/server/index.ts
```

### Testing Extensions

1. Start backend with `USE_DEFAULT_EXTENSIONS=true`
2. Create a new conversation
3. Call extension function in script:
```typescript
const result = await myExtension.myFunction({ param: 'value' });
return result;
```

### Deployment

For production, extensions are copied to `data/{projectId}/extensions/`:

```bash
# Automatic on first project access
# Manual reset via API
POST /api/projects/{projectId}/extensions/reset
```

## API Endpoints

REST API for extension management:

### List Extensions
```
GET /api/projects/{projectId}/extensions
```
Returns all extensions for a project.

### Get Extension
```
GET /api/projects/{projectId}/extensions/{extensionId}
```
Returns a specific extension.

### Create Extension
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

### Update Extension
```
PUT /api/projects/{projectId}/extensions/{extensionId}
```
Body: Same as create (all fields optional).

### Delete Extension
```
DELETE /api/projects/{projectId}/extensions/{extensionId}
```

### Toggle Extension
```
POST /api/projects/{projectId}/extensions/{extensionId}/toggle
```
Toggles the `enabled` state.

### Reset to Defaults
```
POST /api/projects/{projectId}/extensions/reset
```
Deletes all project extensions and copies defaults.

## Key Files Referenced

- **`extension-loader.ts`**: Loading, compiling, executing extensions
- **`extension-context.ts`**: AI context generation from metadata and code
- **`extension-hooks.ts`**: Hook system implementation
- **`extension-storage.ts`**: Storage layer (metadata, code persistence)
- **`defaults/*/`**: Example extension implementations
- **`../../server/extensions-handler.ts`**: REST API endpoints

## Best Practices

1. **Namespace design**: Use kebab-case IDs (`my-extension`) that become camelCase namespaces (`myExtension`)
2. **Error handling**: Always throw descriptive `Error` objects
3. **Type safety**: Define TypeScript interfaces for options/returns
4. **Context quality**: Provide rich `context()` for better LLM usage
5. **Hook cleanup**: Hooks automatically cleaned up on extension unload
6. **UI performance**: Keep message UI components lightweight
7. **Testing**: Use `USE_DEFAULT_EXTENSIONS=true` for rapid iteration
