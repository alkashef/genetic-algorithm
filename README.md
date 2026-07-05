# TSP Genetic Algorithm Visualizer

An interactive web-based visualizer for the Traveling Salesman Problem (TSP) that demonstrates and compares two solution approaches: brute-force optimization and genetic algorithms.

## Overview

This single-page application lets you:
1. **Place cities** on a canvas manually or generate random configurations
2. **Find the optimal solution** using brute-force enumeration
3. **Watch a genetic algorithm evolve** toward the optimal path in real-time

See how a classic genetic algorithm gradually improves its solution while remaining computationally tractable, contrasted with the exponential cost of exhaustive search.

## Features

### City Setup
- **Manual placement**: Toggle "Click to Add" mode to place cities anywhere on the canvas
- **Random generation**: Automatically create a specified number of cities
- **Clear**: Reset all cities and recompute from scratch
- Support for up to 200 cities

### Brute Force (Exact Optimum)
- Exhaustive enumeration of all possible routes
- Finds the mathematically optimal solution
- Real-time progress display: current route, distance, and best found
- Visualizes the optimal route in green
- **Warning**: Route count grows factorially—even 13 cities means 6.2 million routes to check

### Genetic Algorithm
- **Configurable parameters**:
  - Population size (4–2000)
  - Max generations (1–100,000)
  - Crossover rate (0–1)
  - Mutation rate (0–1)
  - Selection method: Tournament (default) or Roulette Wheel
  - Tournament size (when using tournament selection)
  - Elitism (preserve best candidate each generation)
  - Speed control (0–500ms per generation)

- **Algorithm features**:
  - Permutation encoding (each individual is a city tour)
  - Order Crossover (OX) for breeding
  - Swap mutation for exploration
  - Live fitness tracking: best and average distance per generation
  - Real-time visualization of the best tour found and fitness history chart

- **Controls**:
  - **Start**: Run the algorithm until max generations
  - **Pause**: Pause mid-evolution and resume later
  - **Step**: Advance one generation at a time for detailed inspection
  - **Reset**: Clear all progress and start fresh

## Quick Start

⚠️ **Important**: This app uses ES6 modules and **must be served over HTTP**. Do not open `index.html` directly as a file (`file://` URLs will fail).

Start a local web server from the project directory, then open the app in your browser.

**Option 1: Python** (most systems have this)
```bash
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

**Option 2: Node.js**
```bash
npx http-server -p 8000
# Then open http://localhost:8000 in your browser
```

## How to Use

1. After starting the server, open **http://localhost:8000** in your browser
2. **Configure cities** using the City section:
   - Click "Randomize" to auto-generate cities, or
   - Toggle "Click to Add" and click the canvas to manually place cities
3. **Run brute force** to find the optimal solution (works best for 3–12 cities)
4. **Adjust GA parameters** to your preference (population, generations, mutation rate, etc.)
5. **Start the genetic algorithm** and watch it evolve toward the optimum
6. **Compare**: View the GA's best solution against the brute-force result

## Project Structure

```
.
├── index.html          # Single HTML page
├── style.css          # Layout and styling
├── js/
│   ├── main.js        # UI event handlers and orchestration
│   ├── state.js       # City and distance matrix state
│   ├── ga.js          # Genetic algorithm implementation
│   ├── bruteforce.js  # Brute-force solver
│   ├── canvasUtils.js # Canvas drawing utilities
│   └── chart.js       # Fitness history chart
└── README.md          # This file
```

## Technical Details

### Genetic Algorithm
- **Encoding**: Permutation (tour order)
- **Selection**: Tournament selection (configurable) or fitness-proportionate (roulette wheel)
- **Crossover**: Order Crossover (OX)—preserves relative city order
- **Mutation**: Swap mutation—exchanges two random cities
- **Fitness**: Inverse distance (minimize total tour distance)

### Brute Force
- Generates permutations of city indices with the first city fixed (reduces by factor of n)
- Mirrors skipped (clockwise ≈ counterclockwise; reduces by factor of 2)
- Total permutations checked: **(n−1)! / 2**

## Browser Requirements

- Modern browser with ES modules support
- Canvas API
- No external dependencies or build tools

## Tips & Tricks

- **Small problems (3–12 cities)**: Run brute force to find the global optimum, then compare with GA results
- **Larger problems (13+ cities)**: Use GA only (brute force will be very slow)
- **Tuning**: Start with default parameters, then try:
  - Higher mutation rates for more exploration
  - Higher crossover rates to leverage good solutions
  - Smaller tournament sizes (3–5) for more diverse population
  - Elitism enabled to avoid losing the best solution

## Author

Created as a single-page educational tool to visualize evolutionary computation and combinatorial optimization.
