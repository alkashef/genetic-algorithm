#!/bin/bash
# Start the TSP GA Visualizer on macOS/Linux

echo "Starting TSP Genetic Algorithm Visualizer..."
echo ""

# Try Python first
if command -v python3 &> /dev/null; then
    echo "Starting server with Python..."
    python3 -m http.server 8000
    exit 0
elif command -v python &> /dev/null; then
    echo "Starting server with Python..."
    python -m http.server 8000
    exit 0
fi

# Try Node.js
if command -v node &> /dev/null; then
    echo "Starting server with Node.js..."
    npx http-server -p 8000 -o
    exit 0
fi

# No server found
echo "Error: Neither Node.js nor Python found."
echo "Please install one of them or start the server manually:"
echo "  python -m http.server 8000"
echo "  or"
echo "  npx http-server -p 8000"
exit 1
