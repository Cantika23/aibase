#!/bin/bash

# Kill any processes on ports 5040 (backend) and 5050 (frontend)
echo "Freeing ports 5040 and 5050..."
lsof -ti:5040 | xargs kill -9 2>/dev/null || true
lsof -ti:5050 | xargs kill -9 2>/dev/null || true

# Start the development environment with tmux
SESSION_NAME="aibase-dev"

# Check if session already exists
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
    # Create new tmux session
    tmux new-session -d -s $SESSION_NAME

    # Enable mouse scrolling and interaction
    tmux set-option -t $SESSION_NAME mouse on

    # Run backend in the first pane
    tmux send-keys -t $SESSION_NAME:0.0 'cd backend && bun --hot src/server/index.ts' C-m

    # Split window vertically (side by side)
    tmux split-window -h -t $SESSION_NAME:0

    # Run frontend in the second pane
    tmux send-keys -t $SESSION_NAME:0.1 'cd frontend && bun run dev' C-m
fi

# Attach to the session
tmux attach-session -t $SESSION_NAME
