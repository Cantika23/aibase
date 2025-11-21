# AIBase Backend

A multi-client OpenAI-connected backend with WebSocket support and RPC communication.

## Features

- **Multi-client WebSocket connections**: Handle multiple concurrent clients
- **OpenAI Integration**: Full support for chat completions (streaming and non-streaming) and embeddings
- **Tool Calling**: OpenAI-compatible function calling with predefined tools
- **RPC-style communication**: Structured request/response handling
- **Configuration management**: Environment-based configuration
- **Error handling**: Comprehensive error categorization and handling
- **Health checks**: Built-in health and info endpoints
- **Graceful shutdown**: Proper cleanup on shutdown

## Architecture

```
┌─────────────┐    WebSocket    ┌─────────────┐    RPC    ┌─────────────┐
│   Client    │ ──────────────► │   Router    │ ────────► │   Handler   │
└─────────────┘                 └─────────────┘           └─────────────┘
                                        │                        │
                                        ▼                        ▼
                              ┌─────────────┐           ┌─────────────┐
                              │     Hub     │           │  OpenAI API │
                              └─────────────┘           └─────────────┘
```

## Tool Calling

The system supports OpenAI-compatible function calling, allowing AI assistants to execute predefined tools and return results to continue conversations.

### Tool Calling Architecture

```
┌─────────────┐    Tool Call    ┌─────────────┐    Execute    ┌─────────────┐
│   Client    │ ──────────────► │ OpenAI API  │ ────────────► │   Tool      │
└─────────────┘                  └─────────────┘              └─────────────┘
       │                               │                           │
       ▼                               ▼                           ▼
┌─────────────┐                ┌─────────────┐              ┌─────────────┐
│ Tool Defs   │                │ Tool Calls  │              │   Results   │
└─────────────┘                └─────────────┘              └─────────────┘
```

### Available Tools

The system includes several example tools:

- **get_weather** - Mock weather information for any location
- **calculator** - Basic mathematical calculations
- **get_current_time** - Current date/time information

### Tool Data Structures

#### Tool Definition
```go
type ToolDefinition struct {
    Name        string      `json:"name"`
    Description string      `json:"description,omitempty"`
    Parameters  interface{} `json:"parameters"` // JSON schema
}
```

#### Tool Call
```go
type ToolCall struct {
    ID       string           `json:"id"`
    Type     string           `json:"type"` // "function"
    Function ToolCallFunction `json:"function"`
}
```

#### Tool Result
```go
type ToolResult struct {
    ToolCallID string `json:"tool_call_id"`
    Content    string `json:"content"`
    IsError    bool   `json:"is_error,omitempty"`
}
```

### Using Tools with Chat Completion

```json
{
  "type": "chat_completion",
  "request_id": "req-123",
  "payload": {
    "messages": [
      {"role": "user", "content": "What's the weather in San Francisco?"}
    ],
    "tools": [
      {
        "name": "get_weather",
        "description": "Get weather information for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string", "description": "City name"},
            "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
          },
          "required": ["location"]
        }
      }
    ],
    "tool_choice": "auto"
  }
}
```

### Tool Response Handling

When the AI assistant uses tools, the response will include tool calls that can be executed:

```json
{
  "type": "chat_completion_response",
  "request_id": "req-123",
  "data": {
    "choices": [{
      "message": {
        "content": null,
        "tool_calls": [{
          "id": "call_123",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"location\": \"San Francisco, CA\"}"
          }
        }]
      }
    }]
  }
}
```

### Tool Management API

#### List Tools
```json
{
  "type": "tools_list",
  "request_id": "123",
  "payload": {}
}
```

#### Execute Tool
```json
{
  "type": "tool_execute",
  "request_id": "123",
  "payload": {
    "tool_call": {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"San Francisco, CA\"}"
      }
    }
  }
}
```

### Adding New Tools

To add a new tool, implement the `ToolFunction` interface:

```go
type WeatherTool struct{}

func (w *WeatherTool) Name() string {
    return "get_weather"
}

func (w *WeatherTool) Description() string {
    return "Get current weather information for a location"
}

func (w *WeatherTool) Parameters() map[string]interface{} {
    return map[string]interface{}{
        "type": "object",
        "properties": map[string]interface{}{
            "location": map[string]interface{}{
                "type":        "string",
                "description": "The city and state, e.g. San Francisco, CA",
            },
        },
        "required": []string{"location"},
    }
}

func (w *WeatherTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
    location := args["location"].(string)
    // Implement tool logic here
    return fmt.Sprintf("Weather in %s: 22°C, sunny", location), nil
}
```

Register the tool in the OpenAI service:
```go
registry.RegisterTool(&WeatherTool{})
```

## Quick Start

### Prerequisites

- Go 1.21 or later
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
go mod download
```

3. Configure the environment:
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your configuration
# Make sure to set your OpenAI API key
```

4. Run the server:
```bash
go run cmd/server/main.go
```

The server will start on `http://localhost:8080` by default.

### Configuration

The server can be configured via environment variables or a `.env` file:

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

The configuration will automatically load from the `.env` file. You can also use environment variables directly:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Server host |
| `SERVER_PORT` | `8080` | Server port |
| `SERVER_READ_TIMEOUT` | `30` | Read timeout in seconds |
| `SERVER_WRITE_TIMEOUT` | `30` | Write timeout in seconds |
| `OPENAI_API_KEY` | (required) | OpenAI API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | Default OpenAI model |
| `OPENAI_MAX_TOKENS` | `1000` | (optional) Default max tokens |
| `OPENAI_TEMPERATURE` | `0.7` | (optional) Default temperature |
| `DB_TYPE` | `sqlite` | Database type (future use) |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `aibase` | Database name |
| `DB_USER` | | Database username |
| `DB_PASSWORD` | | Database password |

## API

### WebSocket Endpoint

Connect to `ws://localhost:8080/ws` to start communicating with the server.

#### Request Format

```json
{
  "type": "chat_completion|chat_completion_stream|embedding|ping|tools_list|tool_execute",
  "request_id": "unique-request-id",
  "payload": {
    // Request-specific data
  }
}
```

#### Response Format

```json
{
  "type": "response_type",
  "request_id": "corresponding-request-id",
  "data": {
    // Response data
  },
  "error": "error-message-if-any"
}
```

### Supported Request Types

#### 1. Chat Completion

```json
{
  "type": "chat_completion",
  "request_id": "req-123",
  "payload": {
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "model": "gpt-3.5-turbo",
    "max_tokens": 100,
    "temperature": 0.7
  }
}
```

#### 2. Streaming Chat Completion

```json
{
  "type": "chat_completion_stream",
  "request_id": "req-124",
  "payload": {
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Tell me a story"}
    ],
    "model": "gpt-3.5-turbo",
    "max_tokens": 200,
    "temperature": 0.8
  }
}
```

#### 3. Embedding

```json
{
  "type": "embedding",
  "request_id": "req-125",
  "payload": {
    "input": "The quick brown fox jumps over the lazy dog",
    "model": "text-embedding-ada-002"
  }
}
```

#### 4. Ping

```json
{
  "type": "ping",
  "request_id": "req-126"
}
```

#### 5. List Tools

```json
{
  "type": "tools_list",
  "request_id": "req-127",
  "payload": {}
}
```

#### 6. Execute Tool

```json
{
  "type": "tool_execute",
  "request_id": "req-128",
  "payload": {
    "tool_call": {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"San Francisco, CA\"}"
      }
    }
  }
}
```

### HTTP Endpoints

#### Health Check
- `GET /health` - Returns server health status and client count

#### Server Info
- `GET /info` - Returns server configuration information

## Example Usage

### Basic Setup with .env

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Edit your `.env` file:
```env
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Optional: Customize other settings
SERVER_PORT=3000
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.8
```

3. Start the server:
```bash
go run cmd/server/main.go
```

The server will automatically load your configuration from the `.env` file.

### Testing the Server

#### Go Client Example
```bash
go run examples/client/main.go localhost:8080
```

This will:
1. Connect to the WebSocket server
2. Send example requests for each supported type
3. Display responses in real-time
4. Handle streaming responses appropriately

#### TypeScript Client Example
```bash
cd examples/typescript-client
npm install
npm run dev
```

#### Quick Test with curl
```bash
# Check health status
curl http://localhost:8080/health

# Get server info
curl http://localhost:8080/info
```

### Environment Loading Priority

The configuration system follows this priority order:
1. System environment variables (highest priority)
2. `.env` file in the project root
3. Default values (lowest priority)

This means you can override `.env` values by setting environment variables:

```bash
# Override .env OPENAI_API_KEY
export OPENAI_API_KEY="different-key-for-this-session"
go run cmd/server/main.go
```

## Development

### Project Structure

```
backend/
├── cmd/
│   └── server/          # Main server entry point
├── internal/
│   ├── config/          # Configuration management
│   ├── errors/          # Error handling and categorization
│   ├── models/          # Data models and types
│   ├── openai/          # OpenAI API service
│   ├── router/          # Request routing
│   ├── rpc/             # RPC handlers
│   ├── tools/           # Tool system and implementations
│   └── websocket/       # WebSocket connection management
├── examples/
│   └── client/          # Example client implementation
├── go.mod
└── README.md
```

### Testing

Run the example client to test functionality:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-key-here"

# Start the server
go run cmd/server/main.go

# In another terminal, run the client
go run examples/client/main.go
```

## License

Apache-2.0 License
