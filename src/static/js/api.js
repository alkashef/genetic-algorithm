/**
 * @module api
 * @description The only module that talks to the Python backend. Wraps the
 * GA stage endpoints (JSON request/response) and the brute-force endpoint
 * (streamed newline-delimited JSON). No DOM access, no business logic.
 */

/**
 * POST a JSON body and return the parsed JSON response.
 *
 * @param {string} url - Endpoint path.
 * @param {object} body - JSON-serializable request payload.
 * @returns {Promise<object>} The parsed response body.
 * @throws {Error} When the response status is not OK.
 */
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Create the initial random population.
 *
 * @param {number} popSize - Number of individuals.
 * @param {number} numCities - Number of cities (genes per individual).
 * @returns {Promise<number[][]>} The initial population.
 */
export async function initPopulation(popSize, numCities) {
  const { population } = await postJson("/api/ga/init", { popSize, numCities });
  return population;
}

/**
 * Compute each individual's closed-tour distance.
 *
 * @param {number[][]} population - Current population.
 * @param {Array<{x: number, y: number}>} cities - City positions.
 * @returns {Promise<number[]>} Distance per individual.
 */
export async function evaluatePopulation(population, cities) {
  const { distances } = await postJson("/api/ga/evaluate", { population, cities });
  return distances;
}

/**
 * Pick the parent pairs (and elites) that breed the next generation.
 *
 * @param {number[][]} population - Current population.
 * @param {number[]} distances - Distance per individual.
 * @param {{selection: string, tournamentSize: number, eliteCount: number}} params - Selection settings.
 * @returns {Promise<{pairs: number[][], eliteIndices: number[]}>} Selection result.
 */
export async function selectParents(population, distances, params) {
  return postJson("/api/ga/select", { population, distances, params });
}

/**
 * Breed the selected pairs with order crossover.
 *
 * @param {number[][]} population - Current population.
 * @param {number[][]} pairs - Parent index pairs.
 * @param {number[]} eliteIndices - Indices of the elite individuals.
 * @param {number} crossoverRate - Probability in [0,1] that a pair breeds.
 * @returns {Promise<{children: number[][], trace: object[]}>} Children plus per-child trace.
 */
export async function crossoverStage(population, pairs, eliteIndices, crossoverRate) {
  return postJson("/api/ga/crossover", { population, pairs, eliteIndices, crossoverRate });
}

/**
 * Swap-mutate the children produced by the crossover stage.
 *
 * @param {number[][]} children - Children to mutate.
 * @param {object[]} trace - Per-child trace from the crossover stage.
 * @param {number} mutationRate - Probability in [0,1] that a child mutates.
 * @returns {Promise<{children: number[][], trace: object[]}>} Updated children and trace.
 */
export async function mutateStage(children, trace, mutationRate) {
  return postJson("/api/ga/mutate", { children, trace, mutationRate });
}

/**
 * Run the brute-force solver, forwarding each streamed event to the matching
 * callback as it arrives.
 *
 * @param {Array<{x: number, y: number}>} cities - City positions.
 * @param {{onTotal: Function, onProgress: Function, onBest: Function, onDone: Function}} callbacks - Event handlers.
 * @param {AbortSignal} signal - Abort to cancel; the server halts on disconnect.
 * @param {number} stepDelay - Seconds between visualized frames (paced server-side).
 * @returns {Promise<void>} Resolves when the stream ends.
 * @throws {Error} When the response status is not OK.
 */
export async function streamBruteForce(cities, callbacks, signal, stepDelay) {
  const res = await fetch("/api/bruteforce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cities, stepDelay }),
    signal,
  });
  if (!res.ok) throw new Error(`brute force failed: ${res.status} ${res.statusText}`);
  await readEventStream(res.body, (event) => dispatchBruteForceEvent(event, callbacks));
}

/**
 * Read a newline-delimited JSON stream, invoking onEvent per parsed line.
 *
 * @param {ReadableStream} body - The response body stream.
 * @param {(event: object) => void} onEvent - Called for each event object.
 * @returns {Promise<void>} Resolves when the stream is fully consumed.
 */
async function readEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

/**
 * Route one brute-force event to its callback.
 *
 * @param {{type: string}} event - Parsed solver event.
 * @param {{onTotal: Function, onProgress: Function, onBest: Function, onDone: Function}} callbacks - Event handlers.
 * @returns {void}
 */
function dispatchBruteForceEvent(event, callbacks) {
  switch (event.type) {
    case "total": callbacks.onTotal(event.total); break;
    case "progress": callbacks.onProgress(event.route, event.dist, event.count); break;
    case "best": callbacks.onBest(event.route, event.dist, event.count); break;
    case "done": callbacks.onDone(event.route, event.dist, event.count); break;
  }
}
