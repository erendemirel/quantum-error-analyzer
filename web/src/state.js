// Global state management
let circuit = null;
let simulator = null;
let selectedGate = null;
let selectedError = null;
let initialError = null;
let currentTime = 0;
let gateTimePositions = new Map();
let errorHistory = []; // Array of { time, pattern: string, phase: string } objects
let previousCircuitDepth = 0; // Track previous depth to detect growth
let lastPlacedGateTime = -1; // Track the time slot of the last placed gate

export {
    circuit,
    simulator,
    selectedGate,
    selectedError,
    initialError,
    currentTime,
    gateTimePositions,
    errorHistory,
    previousCircuitDepth,
    lastPlacedGateTime
};

// Setters for state updates
export function setCircuit(value) {
    circuit = value;
}

export function setSimulator(value) {
    simulator = value;
}

export function setSelectedGate(value) {
    selectedGate = value;
}

export function setSelectedError(value) {
    selectedError = value;
}

export function setInitialError(value) {
    initialError = value;
}

export function setCurrentTime(value) {
    currentTime = value;
}

export function setPreviousCircuitDepth(value) {
    previousCircuitDepth = value;
}

export function setLastPlacedGateTime(value) {
    lastPlacedGateTime = value;
}

