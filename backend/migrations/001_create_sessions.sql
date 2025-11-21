-- Create sessions table for managing conversation state
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',

    -- Indexes for efficient queries
    INDEX idx_sessions_client_id (client_id),
    INDEX idx_sessions_created_at (created_at),
    INDEX idx_sessions_updated_at (updated_at),
    INDEX idx_sessions_expires_at (expires_at)
);

-- Create session_messages table for conversation history
CREATE TABLE IF NOT EXISTS session_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_call_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for efficient queries
    INDEX idx_session_messages_session_id (session_id),
    INDEX idx_session_messages_created_at (created_at),
    INDEX idx_session_messages_role (role)
);

-- Create tool_state table for persistent tool configurations
CREATE TABLE IF NOT EXISTS tool_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tool_name VARCHAR(255) NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}',
    state_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one tool state per tool per session
    UNIQUE(session_id, tool_name),

    -- Indexes for efficient queries
    INDEX idx_tool_state_session_id (session_id),
    INDEX idx_tool_state_tool_name (tool_name),
    INDEX idx_tool_state_updated_at (updated_at)
);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_state_updated_at BEFORE UPDATE ON tool_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();