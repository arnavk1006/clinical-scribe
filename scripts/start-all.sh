#!/bin/bash

# Load local .env variables if the file exists
if [ -f .env ]; then
    # Read variables from .env (ignoring comments/empty lines)
    export $(grep -v '^#' .env | xargs)
fi

# Configuration (with defaults)
WHISPER_DIR="${WHISPER_DIR:-../whisper-server}"
WHISPER_MODEL="${WHISPER_MODEL:-ggml-small.bin}"
WHISPER_PORT="${WHISPER_PORT:-8080}"

# Expand tilde (~) to home directory if present
if [[ "$WHISPER_DIR" == ~* ]]; then
    WHISPER_DIR="${WHISPER_DIR/#\~/$HOME}"
fi


# Detect if -d (detached mode) is passed
IS_DETACHED=false
for arg in "$@"; do
    if [ "$arg" = "-d" ] || [ "$arg" = "--detach" ]; then
        IS_DETACHED=true
        break
    fi
done

# Function to clean up background/host processes on exit
cleanup() {
    echo -e "\nStopping services..."
    if [ -n "$WHISPER_PID" ]; then
        echo "Stopping Whisper server (PID: $WHISPER_PID)..."
        kill "$WHISPER_PID" 2>/dev/null
    fi
    if [ "$IS_DETACHED" = false ]; then
        echo "Stopping Docker containers..."
        docker compose down
    fi
    exit
}

# Trap Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM
if [ "$IS_DETACHED" = false ]; then
    trap cleanup EXIT
fi

# 1. Start the Whisper Speech-to-Text server on the host (macOS)
echo "Checking if port $WHISPER_PORT is in use..."
if lsof -i :$WHISPER_PORT >/dev/null 2>&1; then
    echo "Port $WHISPER_PORT is already in use. Assuming Whisper (or another service) is already running."
else
    echo "Starting Whisper server on host (port $WHISPER_PORT)..."
    cd "$WHISPER_DIR" || { echo "Failed to navigate to $WHISPER_DIR"; exit 1; }
    
    # Run Whisper in background, outputting logs to whisper.log
    ./whisper-server-small -m "$WHISPER_MODEL" --port "$WHISPER_PORT" > whisper.log 2>&1 &
    WHISPER_PID=$!
    
    # Go back to the project root directory
    cd - > /dev/null || exit 1
    
    # Wait a couple of seconds to make sure it started successfully
    sleep 2
    if ps -p "$WHISPER_PID" > /dev/null; then
        echo "Whisper server started successfully (PID: $WHISPER_PID)."
        echo "Logs are available at: $WHISPER_DIR/whisper.log"
    else
        echo "Error: Failed to start Whisper server. Check logs at: $WHISPER_DIR/whisper.log"
        exit 1
    fi
fi

# 2. Start the Docker Compose stack (Redis, Backend, Frontend)
echo "Starting Docker Compose services..."
docker compose up "$@"
