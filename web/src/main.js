let init, WasmCircuit, WasmSimulator, WasmPauliString;

async function loadWasm() {
    try {
        const wasmModule = await import('../wasm-pkg/quantum_error_analyzer_wasm.js');
        init = wasmModule.default;
        WasmCircuit = wasmModule.WasmCircuit;
        WasmSimulator = wasmModule.WasmSimulator;
        WasmPauliString = wasmModule.WasmPauliString;
        await init();
        return true;
    } catch (e) {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'padding: 20px; margin: 20px; background: #fee; border: 2px solid #f00; border-radius: 8px; color: #c00;';
        errorMsg.innerHTML = `
            <h2 style="margin-top: 0;">WASM Module Not Found</h2>
            <p>Please build the WASM module first:</p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">bun run build:wasm</pre>
            <p>Or run the full setup:</p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">bun run setup</pre>
        `;
        document.getElementById('app').appendChild(errorMsg);
        console.error('Failed to load WASM module:', e);
        return false;
    }
}

let circuit = null;
let simulator = null;
let selectedGate = null;
let selectedError = null;
let initialError = null;
let currentTime = 0;
let gateTimePositions = new Map();
let errorHistory = []; // Array of { time, pattern: string, phase: string } objects
let previousCircuitDepth = 0; // Track previous depth to detect growth

function getCircuitDepth() {
    if (gateTimePositions.size === 0) {
        return 0;
    }
    const timeSlots = Array.from(gateTimePositions.values());
    if (timeSlots.length === 0) {
        return 0;
    }
    const maxTimeSlot = Math.max(...timeSlots);
    const depth = maxTimeSlot + 1;
    return depth;
}

async function initApp() {
    const wasmLoaded = await loadWasm();
    
    if (!wasmLoaded || !WasmCircuit) {
        return;
    }
    
    circuit = new WasmCircuit(2);
    simulator = new WasmSimulator(circuit);
    
    setupCircuitConfig();
    setupGatePalette();
    setupErrorControls();
    setupSimulationControls();
    // Initialize currentTime to 0 (time slot 0)
    currentTime = 0;
    previousCircuitDepth = 0; // Initialize depth tracking for auto-scroll
    // Update qubit count input to reflect current circuit
    const qubitCountInput = document.getElementById('qubit-count-input');
    if (qubitCountInput) {
        qubitCountInput.value = circuit.num_qubits();
    }
    renderCircuit();
    updateDisplay();
    
    // Update separators on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateTimeSeparators();
        }, 100);
    });
}

function setupCircuitConfig() {
    const config = document.getElementById('circuit-config');
    config.innerHTML = '<h3>Circuit</h3><div class="qubit-config"></div>';
    const qubitConfig = config.querySelector('.qubit-config');
    
    qubitConfig.innerHTML = `
        <label style="display: block; margin-bottom: 8px;">
            Number of Qubits:
            <input type="number" id="qubit-count-input" min="1" max="1000" value="2" style="width: 80px; margin-left: 8px; padding: 4px;">
        </label>
        <button id="change-qubit-count-btn" style="width: 100%; padding: 8px; margin-top: 8px; font-weight: normal; border: 1px solid #645966;">Update Circuit</button>
    `;
    
    const qubitCountInput = document.getElementById('qubit-count-input');
    const changeBtn = document.getElementById('change-qubit-count-btn');
    
    changeBtn.addEventListener('click', () => {
        const newCount = parseInt(qubitCountInput.value, 10);
        if (isNaN(newCount) || newCount < 1 || newCount > 1000) {
            alert('Please enter a valid number of qubits between 1 and 1000');
            qubitCountInput.value = circuit ? circuit.num_qubits() : 2;
            return;
        }
        changeQubitCount(newCount);
    });
    
    // Allow Enter key to trigger update
    qubitCountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            changeBtn.click();
        }
    });
}

function changeQubitCount(newCount) {
    if (!circuit || newCount === circuit.num_qubits()) {
        return;
    }
    
    // Save current state
    const savedGates = Array.from(circuit.get_gates());
    const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
    
    // Create new circuit with new qubit count
    circuit = new WasmCircuit(newCount);
    simulator = new WasmSimulator(circuit);
    
    // Restore gates that are still valid (qubit indices within new range)
    savedGates.forEach(gate => {
        try {
            if (gate.Single) {
                if (gate.Single.qubit < newCount) {
                    circuit.add_single_gate(gate.Single.qubit, gate.Single.gate);
                }
            } else if (gate.Two) {
                if (gate.Two.CNOT) {
                    if (gate.Two.CNOT.control < newCount && gate.Two.CNOT.target < newCount) {
                        circuit.add_cnot(gate.Two.CNOT.control, gate.Two.CNOT.target);
                    }
                } else if (gate.Two.CZ) {
                    if (gate.Two.CZ.control < newCount && gate.Two.CZ.target < newCount) {
                        circuit.add_cz(gate.Two.CZ.control, gate.Two.CZ.target);
                    }
                } else if (gate.Two.SWAP) {
                    if (gate.Two.SWAP.qubit1 < newCount && gate.Two.SWAP.qubit2 < newCount) {
                        circuit.add_swap(gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2);
                    }
                }
            }
        } catch (e) {
            // Skip invalid gates (e.g., qubit index out of range)
            console.warn('Skipping gate due to qubit count change:', e);
        }
    });
    
    // Restore errors if qubits are still valid
    // initialError is stored as {qubit: errorType} object
    if (savedError && Object.keys(savedError).length > 0) {
        initialError = {};
        Object.keys(savedError).forEach(q => {
            const qubit = parseInt(q);
            if (qubit < newCount) {
                initialError[q] = savedError[q];
                simulator.inject_error(qubit, savedError[q]);
            }
        });
        // If no errors were valid, clear initialError
        if (Object.keys(initialError).length === 0) {
            initialError = null;
        }
    } else {
        initialError = null;
    }
    
    // Reset simulation state
    currentTime = 0;
    previousCircuitDepth = 0;
    gateTimePositions.clear();
    errorHistory = [];
    
    // Update UI
    const qubitCountInput = document.getElementById('qubit-count-input');
    if (qubitCountInput) {
        qubitCountInput.value = newCount;
    }
    setupErrorControls(); // Update qubit selector
    renderCircuit();
    updateDisplay();
}

function setupGatePalette() {
    const palette = document.getElementById('gate-palette');
    palette.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h3 style="margin: 0;">Gates</h3>
            <span class="info-tooltip" style="position: relative; cursor: help;">
                <span style="font-size: 0.9rem; color: #666; border: 1px solid #ccc; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; background: #f0f0f0;">?</span>
                <span class="tooltip-text" style="visibility: hidden; width: 200px; background-color: #f5f5f5; color: #333; text-align: left; border-radius: 6px; padding: 8px; position: absolute; z-index: 1000; bottom: 125%; left: 50%; margin-left: -100px; font-size: 0.75rem; line-height: 1.4; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #ddd;">
                    <strong>Gate Operations:</strong><br>
                    • Click to place/replace gates<br>
                    • Right-click to remove gates
                    <span style="position: absolute; top: 100%; left: 50%; margin-left: -5px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #f5f5f5;"></span>
                </span>
            </span>
        </div>
        <div class="gate-buttons"></div>
    `;
    const buttons = palette.querySelector('.gate-buttons');
    
    // Add tooltip hover functionality
    const tooltip = palette.querySelector('.info-tooltip');
    const tooltipText = palette.querySelector('.tooltip-text');
    tooltip.addEventListener('mouseenter', () => {
        tooltipText.style.visibility = 'visible';
    });
    tooltip.addEventListener('mouseleave', () => {
        tooltipText.style.visibility = 'hidden';
    });
    
    const gates = [
        { name: 'H', label: 'H' },
        { name: 'S', label: 'S' },
        { name: 'Sdg', label: 'S†' },
        { name: 'X', label: 'X' },
        { name: 'Y', label: 'Y' },
        { name: 'Z', label: 'Z' },
        { name: 'CNOT', label: 'CNOT' },
        { name: 'CZ', label: 'CZ' },
        { name: 'SWAP', label: 'SWAP' },
    ];
    
    gates.forEach(gate => {
        const btn = document.createElement('button');
        btn.className = 'gate-btn';
        btn.textContent = gate.label;
        btn.dataset.gate = gate.name;
        btn.addEventListener('click', () => {
            const previousSelectedGate = selectedGate;
            // If clicking the same gate that's already selected, keep it selected
            // (don't toggle off - this allows placing multiple gates of the same type)
            if (selectedGate === gate.name) {
                // Keep it selected - don't toggle off
                return;
            }
            // If clicking a different gate, deselect previous and select new one
            document.querySelectorAll('.gate-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedGate = gate.name;
            renderCircuit();
        });
        buttons.appendChild(btn);
    });
}

function setupErrorControls() {
    const controls = document.getElementById('error-controls');
    controls.innerHTML = '<h3>Inject Error</h3><div class="qubit-selector"></div><div class="error-buttons"></div>';
    
    const qubitSelector = controls.querySelector('.qubit-selector');
    qubitSelector.innerHTML = '<label>Qubit: <select id="error-qubit-select"></select></label>';
    const qubitSelect = document.getElementById('error-qubit-select');
    
    const updateQubitOptions = () => {
        qubitSelect.innerHTML = '';
        const numQubits = circuit ? circuit.num_qubits() : 2;
        for (let q = 0; q < numQubits; q++) {
            const option = document.createElement('option');
            option.value = q;
            option.textContent = `Q${q}`;
            qubitSelect.appendChild(option);
        }
    };
    updateQubitOptions();
    
    const errorButtons = controls.querySelector('.error-buttons');
    errorButtons.innerHTML = '<label style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: #555;">Error:</label>';
    
    const errors = [
        { type: 'X', class: 'error-x', color: '#e65a6e' },
        { type: 'Y', class: 'error-y', color: '#6bc4a8' },
        { type: 'Z', class: 'error-z', color: '#e6c85a' },
        { type: 'I', class: 'error-i', color: '#bdc3c7' },
    ];
    
    errors.forEach(err => {
        const btn = document.createElement('button');
        btn.className = `error-btn ${err.class}`;
        btn.textContent = err.type;
        btn.dataset.error = err.type;
        btn.addEventListener('click', () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll('.error-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const previousSelectedError = selectedError;
            selectedError = err.type;
            
            if (simulator) {
                const qubit = parseInt(qubitSelect.value);
                const currentPattern = simulator.get_error_pattern().to_string();
                const currentPhase = simulator.get_error_pattern().get_phase();
                injectError(qubit);
            } else {
                console.warn('[WARN] Error button clicked but no simulator:', {
                    errorType: err.type,
                    hasSimulator: !!simulator
                });
            }
        });
        errorButtons.appendChild(btn);
    });
    
    selectedError = null;
    
    window.updateErrorControls = updateQubitOptions;
}

function updateTimeSeparators() {
    if (!circuit) return;
    
    const circuitView = document.getElementById('circuit-view');
    if (!circuitView) return;
    
    const svg = circuitView.querySelector('.circuit-svg');
    if (!svg) return;
    
    // Remove existing SVG separators
    const existingSvgSeparators = svg.querySelectorAll('.time-separator-line');
    existingSvgSeparators.forEach(sep => sep.remove());
    
    // Use the same constants as renderCircuit
    const depth = Math.max(getCircuitDepth(), 5);
    const numQubits = circuit.num_qubits();
    const spacing = 100;
    const startX = 100;
    const qubitSpacing = 80;
    
    // Match highlighting boundaries: from top (y=0) to bottom of last qubit
    const topY = 0;
    const bottomY = 40 + numQubits * qubitSpacing;
    
    // Collect all separators first, then insert them in order
    // This ensures they appear in the correct order in the DOM (t=0, t=1, t=2, ...)
    const separators = [];
    for (let t = 0; t < depth; t++) {
        const x = startX + (t + 0.5) * spacing;
        
        const separator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        separator.setAttribute('class', 'time-separator-line');
        separator.setAttribute('x1', x);
        separator.setAttribute('y1', topY);
        separator.setAttribute('x2', x);
        separator.setAttribute('y2', bottomY);
        separator.setAttribute('stroke', '#bbb');
        separator.setAttribute('stroke-width', '1');
        separator.setAttribute('stroke-dasharray', '3,3');
        separator.setAttribute('opacity', '0.7');
        
        // Highlight separators up to currentTime
        if (t < currentTime) {
            separator.setAttribute('stroke', '#625264');
            separator.setAttribute('stroke-dasharray', 'none');
            separator.setAttribute('opacity', '1');
        }
        
        separators.push(separator);
    }
    
    // Insert all separators at the beginning, in order
    // Insert in reverse order so they end up in correct order (t=0 first, then t=1, etc.)
    const firstChild = svg.firstChild;
    for (let i = separators.length - 1; i >= 0; i--) {
        if (firstChild) {
            svg.insertBefore(separators[i], firstChild);
        } else {
            svg.appendChild(separators[i]);
        }
    }
}

function stepToTime(targetTime) {
    if (!simulator || !circuit) return;
    
    const circuitGates = circuit.get_gates();
    let currentTimeSlot = currentTime;
    
    // Step forward by time slots, applying all parallel gates at each time slot
    while (currentTimeSlot < targetTime) {
        // Find all gates at the current time slot
        const gatesAtCurrentTimeSlot = [];
        circuitGates.forEach((gate, idx) => {
            const gateTime = gateTimePositions.get(idx);
            if (gateTime === currentTimeSlot) {
                gatesAtCurrentTimeSlot.push({ gate, index: idx });
            }
        });
        
        if (gatesAtCurrentTimeSlot.length === 0) {
            // No gates at this time slot, just advance
            currentTimeSlot++;
            continue;
        }
        
        // Process all gates at this time slot
        // Get the max gate index at this time slot
        const maxGateIndex = Math.max(...gatesAtCurrentTimeSlot.map(g => g.index));
        
        // Step forward through all gates at this time slot
        // The simulator's current_time() returns the next gate index to process
        while (simulator.current_time() <= maxGateIndex) {
            const nextGateIndex = simulator.current_time();
            const nextGateTime = gateTimePositions.get(nextGateIndex);
            
            // Only process gates that belong to the current time slot
            if (nextGateTime === currentTimeSlot) {
                if (!simulator.step_forward()) break;
            } else if (nextGateTime < currentTimeSlot) {
                // This gate should have been processed already, skip it
                if (!simulator.step_forward()) break;
            } else {
                // This gate belongs to a future time slot, stop here
                break;
            }
        }
        
        recordErrorHistory();
        currentTimeSlot++;
    }
    
    // If stepping backward, reset and step forward to target
    if (targetTime < currentTime) {
        // Deep copy initialError to ensure it's not modified
        const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
        const savedGates = Array.from(circuitGates);
        const numQubits = circuit.num_qubits();
        circuit = new WasmCircuit(numQubits);
        savedGates.forEach(gate => {
            if (gate.Single) {
                circuit.add_single_gate(gate.Single.qubit, gate.Single.gate);
            } else if (gate.Two) {
                if (gate.Two.CNOT) {
                    circuit.add_cnot(gate.Two.CNOT.control, gate.Two.CNOT.target);
                } else if (gate.Two.CZ) {
                    circuit.add_cz(gate.Two.CZ.control, gate.Two.CZ.target);
                } else if (gate.Two.SWAP) {
                    circuit.add_swap(gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2);
                }
            }
        });
        simulator = new WasmSimulator(circuit);
        if (savedError) {
            Object.keys(savedError).forEach(q => {
                simulator.inject_error(parseInt(q), savedError[q]);
            });
        }
        
        currentTimeSlot = 0;
        while (currentTimeSlot < targetTime) {
            const gatesAtCurrentTimeSlot = [];
            savedGates.forEach((gate, idx) => {
                const gateTime = gateTimePositions.get(idx);
                if (gateTime === currentTimeSlot) {
                    gatesAtCurrentTimeSlot.push({ gate, index: idx });
                }
            });
            
            if (gatesAtCurrentTimeSlot.length === 0) {
                currentTimeSlot++;
                continue;
            }
            
            const maxGateIndexAtTimeSlot = Math.max(...gatesAtCurrentTimeSlot.map(g => g.index));
            while (simulator.current_time() <= maxGateIndexAtTimeSlot) {
                const nextGateIndex = simulator.current_time();
                const nextGateTime = gateTimePositions.get(nextGateIndex);
                if (nextGateTime === currentTimeSlot) {
                    if (!simulator.step_forward()) break;
                } else if (nextGateTime < currentTimeSlot) {
                    if (!simulator.step_forward()) break;
                } else {
                    break;
                }
            }
            currentTimeSlot++;
        }
    }
    
    currentTime = targetTime;
    updateDisplay();
    renderCircuit();
    
    // Update step controls
    if (window.updateStepControls) {
        window.updateStepControls();
    }
}

function setupSimulationControls() {
    const controls = document.getElementById('simulation-controls');
    controls.innerHTML = '<h3>Simulation</h3><div class="sim-step-controls"></div><div class="sim-buttons"></div>';
    
    const stepControls = controls.querySelector('.sim-step-controls');
    stepControls.innerHTML = `
        <div class="step-buttons">
            <button id="step-back-btn" class="step-btn">← Step Back</button>
            <span class="time-display-text">Time: <span id="current-time-display">0</span> / <span id="max-time-display">0</span></span>
            <button id="step-forward-btn" class="step-btn">Step Forward →</button>
        </div>
    `;
    
    const stepBackBtn = document.getElementById('step-back-btn');
    const stepForwardBtn = document.getElementById('step-forward-btn');
    const currentTimeDisplay = document.getElementById('current-time-display');
    const maxTimeDisplay = document.getElementById('max-time-display');
    
    const updateStepControls = () => {
        if (circuit) {
            const maxTime = getCircuitDepth();
            maxTimeDisplay.textContent = maxTime;
            currentTimeDisplay.textContent = currentTime;
            stepBackBtn.disabled = currentTime <= 0;
            stepForwardBtn.disabled = currentTime >= maxTime;
        }
    };
    
    stepBackBtn.addEventListener('click', () => {
        if (currentTime > 0) {
            stepToTime(currentTime - 1);
            updateStepControls();
        }
    });
    
    stepForwardBtn.addEventListener('click', () => {
        const maxTime = getCircuitDepth();
        if (currentTime < maxTime) {
            stepToTime(currentTime + 1);
            updateStepControls();
        }
    });
    
    window.updateStepControls = updateStepControls;
    // Expose placeGateAtNextTimeSlot for testing and programmatic use
    window.placeGateAtNextTimeSlot = placeGateAtNextTimeSlot;
    window.placeGate = placeGate;
    // Expose circuit, gateTimePositions, and simulator for debugging
    Object.defineProperty(window, 'circuit', {
        get: () => circuit,
        configurable: true
    });
    Object.defineProperty(window, 'gateTimePositions', {
        get: () => gateTimePositions,
        configurable: true
    });
    Object.defineProperty(window, 'simulator', {
        get: () => simulator,
        configurable: true
    });
    updateStepControls();
    
    // Update when circuit changes
    window.updateSimulationControls = () => {
        updateStepControls();
        requestAnimationFrame(() => {
            setTimeout(() => {
                updateTimeSeparators();
            }, 0);
        });
    };
    
    const buttons = controls.querySelector('.sim-buttons');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'sim-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
        reset();
        updateStepControls();
    });
    buttons.appendChild(resetBtn);
}

function renderCircuit() {
    const view = document.getElementById('circuit-view');
    const numQubits = circuit.num_qubits();
    const depth = Math.max(getCircuitDepth(), 5);
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'circuit-svg');
    
    // Get the actual available width for the circuit view first
    let containerWidth = view.offsetWidth || view.getBoundingClientRect().width;
    
    // If width is 0 or very small, it might not be laid out yet - use parent width as fallback
    if (!containerWidth || containerWidth < 100) {
        const parent = view.parentElement;
        if (parent) {
            containerWidth = parent.offsetWidth - 40; // Subtract padding (20px * 2)
        }
    }
    
    // Final fallback
    if (!containerWidth || containerWidth < 100) {
        containerWidth = 800;
    }
    
    const spacing = 100;
    const qubitSpacing = 80;
    const startX = 100;
    
    // Calculate the width needed for the circuit based on depth
    const circuitWidth = depth * spacing + startX;
    // Use the larger of container width or circuit width to fill the space
    const displayWidth = Math.max(containerWidth, circuitWidth);
    
    // Calculate viewBox dimensions - ensure it covers at least the container width
    const viewBoxWidth = Math.max(displayWidth, depth * 100 + 100);
    const viewBoxHeight = numQubits * 80 + 40;
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    
    // Fixed minimum scale implementation
    // Minimum scale of 0.75 ensures gates remain readable (75% of original size minimum)
    // Higher scale means scrolling appears earlier, keeping gates more visible
    const MIN_SCALE = 0.75;
    const minSvgWidth = viewBoxWidth * MIN_SCALE;
    
    // Set SVG width to maintain minimum readability
    // If container is smaller than minimum, use minimum width (enables scrolling)
    // Otherwise, let it scale naturally but not below minimum
    if (minSvgWidth > containerWidth) {
        // SVG is wider than container - set fixed width to enable scrolling
        svg.style.width = `${minSvgWidth}px`;
        svg.style.minWidth = `${minSvgWidth}px`;
        svg.style.maxWidth = `${minSvgWidth}px`; // Prevent expansion
        // Calculate height to maintain aspect ratio
        const aspectRatio = viewBoxHeight / viewBoxWidth;
        svg.style.height = `${minSvgWidth * aspectRatio}px`;
    } else {
        // For smaller circuits, fill the container width to eliminate gap
        svg.style.width = '100%';
        svg.style.maxWidth = '100%'; // Prevent expansion beyond container
        svg.style.height = 'auto';
    }
    
    // Separators are now drawn directly in the SVG for perfect alignment
    // - see updateTimeSeparators()
    
    // Add background highlighting for executed time slots
    // Qubit lines are at y = 40 + q * qubitSpacing
    // First qubit (Q0) is at y = 40, last qubit (Q1) is at y = 40 + 80 = 120
    // Highlighting should start at top and extend to bottom of last qubit
    const highlightTopY = 0; // Start at top of SVG
    const highlightBottomY = 40 + numQubits * qubitSpacing; // End at bottom of last qubit (Q1 at y=120, extend to y=200)
    const highlightHeight = highlightBottomY - highlightTopY; // Height from top to bottom of last qubit
    
    for (let t = 0; t < currentTime; t++) {
        const x = startX + t * spacing;
        const highlightRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlightRect.setAttribute('class', 'time-slot-highlight');
        highlightRect.setAttribute('x', x - spacing / 2);
        highlightRect.setAttribute('y', highlightTopY);
        highlightRect.setAttribute('width', spacing);
        highlightRect.setAttribute('height', highlightHeight);
        highlightRect.setAttribute('fill', '#c7c5c7');
        highlightRect.setAttribute('opacity', '0.5');
        highlightRect.setAttribute('rx', '4');
        svg.appendChild(highlightRect);
    }
    
    // Calculate the width to draw qubit lines - extend to fill container or circuit width
    const lineEndX = Math.max(displayWidth - startX, depth * spacing);
    
    // Add light grid separators in empty areas to show the grid structure
    const maxTimeSlotsForGrid = Math.ceil((displayWidth - startX) / spacing);
    const topY = 0;
    const bottomY = 40 + numQubits * qubitSpacing;
    
    // Add light grid lines for empty time slots (beyond depth)
    for (let t = depth; t < maxTimeSlotsForGrid; t++) {
        const x = startX + (t + 0.5) * spacing;
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('class', 'qubit-line');
        gridLine.setAttribute('x1', x);
        gridLine.setAttribute('y1', topY);
        gridLine.setAttribute('x2', x);
        gridLine.setAttribute('y2', bottomY);
        gridLine.setAttribute('stroke', '#f0f0f0');
        gridLine.setAttribute('stroke-width', '1');
        gridLine.setAttribute('stroke-dasharray', '2,4');
        gridLine.setAttribute('opacity', '0.5');
        svg.appendChild(gridLine);
    }
    
    for (let q = 0; q < numQubits; q++) {
        const y = 40 + q * qubitSpacing;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'qubit-line');
        line.setAttribute('x1', startX);
        line.setAttribute('y1', y);
        line.setAttribute('x2', startX + lineEndX);
        line.setAttribute('y2', y);
        svg.appendChild(line);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', '20');
        label.setAttribute('y', y);
        label.setAttribute('class', 'gate-symbol');
        label.textContent = `Q${q}`;
        svg.appendChild(label);
        
        // Calculate how many time slots to show - extend to fill container width
        const maxTimeSlots = Math.max(depth + 1, Math.ceil((displayWidth - startX) / spacing));
        
        for (let t = 0; t <= maxTimeSlots; t++) {
            const x = startX + t * spacing;
            // Don't create click areas beyond reasonable limits
            if (x > displayWidth + spacing) break;
            
            const clickArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clickArea.setAttribute('x', x - spacing / 2);
            clickArea.setAttribute('y', y - qubitSpacing / 2);
            clickArea.setAttribute('width', spacing);
            clickArea.setAttribute('height', qubitSpacing);
            clickArea.setAttribute('fill', 'transparent');
            clickArea.setAttribute('class', 'gate-placement-area');
            clickArea.setAttribute('data-qubit', q);
            clickArea.setAttribute('data-time', t);
            if (selectedGate) {
                clickArea.style.cursor = 'pointer';
            } else {
                clickArea.style.cursor = 'default';
            }
            clickArea.addEventListener('click', handleCircuitClick);
            clickArea.addEventListener('contextmenu', handleCircuitRightClick);
            // Store reference to click area for gate hover coordination
            clickArea._isGateHovered = false;
            
            const highlightClickArea = (target) => {
                if (selectedGate) {
                    target.setAttribute('fill', 'rgba(52, 152, 219, 0.15)');
                    target.setAttribute('stroke', 'rgba(52, 152, 219, 0.5)');
                    target.setAttribute('stroke-width', '2');
                    target.setAttribute('stroke-dasharray', '4,4');
                }
            };
            
            const unhighlightClickArea = (target) => {
                // Only remove highlight if not being hovered by a gate
                if (!target._isGateHovered) {
                    target.setAttribute('fill', 'transparent');
                    target.removeAttribute('stroke');
                    target.removeAttribute('stroke-width');
                    target.removeAttribute('stroke-dasharray');
                }
            };
            
            clickArea.addEventListener('mouseenter', (e) => {
                e.target._isGateHovered = false; // Reset flag when directly hovering click area
                highlightClickArea(e.target);
            });
            clickArea.addEventListener('mouseleave', (e) => {
                unhighlightClickArea(e.target);
            });
            svg.appendChild(clickArea);
        }
    }
    
    try {
        const gates = circuit.get_gates();
        if (Array.isArray(gates)) {
            const gateTimeMap = new Map();
            
            gates.forEach((gate, idx) => {
                if (gate && (gate.Single || gate.Two)) {
                    let timeSlot = gateTimePositions.get(idx);
                    
                    if (timeSlot === undefined) {
                        let qubits = [];
                        if (gate.Single) {
                            qubits = [gate.Single.qubit];
                        } else if (gate.Two) {
                            if (gate.Two.CNOT) {
                                qubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                            } else if (gate.Two.CZ) {
                                qubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                            } else if (gate.Two.SWAP) {
                                qubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                            }
                        }
                        
                        for (let t = 0; t <= depth; t++) {
                            const gatesAtTime = gateTimeMap.get(t) || [];
                            const hasConflict = gatesAtTime.some(({gate: g, idx: gIdx}) => {
                                const gTime = gateTimePositions.get(gIdx);
                                if (gTime !== undefined && gTime === t) {
                                    let gQubits = [];
                                    if (g.Single) gQubits = [g.Single.qubit];
                                    else if (g.Two) {
                                        if (g.Two.CNOT) gQubits = [g.Two.CNOT.control, g.Two.CNOT.target];
                                        else if (g.Two.CZ) gQubits = [g.Two.CZ.control, g.Two.CZ.target];
                                        else if (g.Two.SWAP) gQubits = [g.Two.SWAP.qubit1, g.Two.SWAP.qubit2];
                                    }
                                    return qubits.some(q => gQubits.includes(q));
                                }
                                return false;
                            });
                            
                            if (!hasConflict) {
                                timeSlot = t;
                                gateTimePositions.set(idx, t);
                                break;
                            }
                        }
                    }
                    
                    if (!gateTimeMap.has(timeSlot)) {
                        gateTimeMap.set(timeSlot, []);
                    }
                    gateTimeMap.get(timeSlot).push({gate, idx});
                } else {
                    console.warn('Invalid gate at index', idx, ':', gate);
                }
            });
            
            gateTimeMap.forEach((gatesAtTime, timeSlot) => {
                gatesAtTime.forEach(({gate}) => {
                    renderGate(svg, gate, timeSlot, spacing, qubitSpacing, startX);
                });
            });
        } else {
            console.warn('Gates is not an array:', gates, typeof gates);
        }
    } catch (e) {
        console.error('Error rendering gates:', e);
    }
    
    // Render initial errors at time 0 using initialError, not simulator's current state
    // The simulator's current state changes as we step forward (errors propagate),
    // but we want to show the initial errors at time 0
    if (initialError) {
        Object.keys(initialError).forEach(q => {
            const error = initialError[q];
            if (error && error !== 'I') {
                renderError(svg, error, parseInt(q), 0, spacing, qubitSpacing, startX);
            }
        });
    }
    
    const gates = circuit.get_gates();
    const hasGates = gates && Array.isArray(gates) && gates.length > 0;
    const hasErrors = simulator && (() => {
        const errorPattern = simulator.get_error_pattern();
        for (let q = 0; q < numQubits; q++) {
            if (errorPattern.get_pauli(q) !== 'I') return true;
        }
        return false;
    })();
    
    view.innerHTML = '';
    view.appendChild(svg);
    
    if (!hasGates && !hasErrors) {
        const hint = document.createElement('div');
        hint.className = 'circuit-empty-hint';
        hint.innerHTML = `
            <div style="margin-bottom: 8px; color: #666;">1. Select the gates from the left panel</div>
            <div style="margin-bottom: 8px; color: #666;">2. Click on the circuit above to (re)place them. Right click on gates on the circuit to remove them</div>
            <div style="margin-bottom: 8px; color: #666;">3. Inject errors using the error buttons</div>
            <div style="color: #666;">4. Use step buttons below to step through the circuit</div>
        `;
        view.appendChild(hint);
    }
    
    // Update separators
    // Use requestAnimationFrame to ensure SVG is fully rendered
    requestAnimationFrame(() => {
        setTimeout(() => {
            updateTimeSeparators();
            
            // Auto-scroll to the right if circuit has grown
            const currentDepth = getCircuitDepth();
            if (currentDepth > previousCircuitDepth) {
                // Circuit has grown - scroll to the right to show the new gates
                const scrollWidth = view.scrollWidth;
                const clientWidth = view.clientWidth;
                if (scrollWidth > clientWidth) {
                    view.scrollLeft = scrollWidth - clientWidth;
                }
            }
            previousCircuitDepth = currentDepth;
        }, 0);
    });
}

function renderGate(svg, gate, time, spacing, qubitSpacing, startX) {
    const x = startX + time * spacing;
    
    // Helper function to add interactivity to gate elements
    const addGateInteractivity = (element, qubit) => {
        element.setAttribute('data-qubit', qubit);
        element.setAttribute('data-time', time);
        element.style.cursor = 'pointer';
        element.addEventListener('click', handleCircuitClick);
        element.addEventListener('contextmenu', handleCircuitRightClick);
        
        // Store reference to click area for this qubit/time
        let clickAreaRef = null;
        
        element.addEventListener('mouseenter', (e) => {
            e.target.style.opacity = '0.8';
            // Find and highlight the corresponding click area
            const svg = e.target.ownerSVGElement;
            if (svg) {
                clickAreaRef = svg.querySelector(`rect.gate-placement-area[data-qubit="${qubit}"][data-time="${time}"]`);
                if (clickAreaRef) {
                    clickAreaRef._isGateHovered = true;
                    if (selectedGate) {
                        clickAreaRef.setAttribute('fill', 'rgba(52, 152, 219, 0.15)');
                        clickAreaRef.setAttribute('stroke', 'rgba(52, 152, 219, 0.5)');
                        clickAreaRef.setAttribute('stroke-width', '2');
                        clickAreaRef.setAttribute('stroke-dasharray', '4,4');
                    }
                }
            }
        });
        
        element.addEventListener('mouseleave', (e) => {
            e.target.style.opacity = '1';
            // Clear gate hover flag and remove highlight if mouse truly left
            if (clickAreaRef) {
                clickAreaRef._isGateHovered = false;
                // Small delay to check if mouse moved to click area
                setTimeout(() => {
                    if (clickAreaRef && !clickAreaRef._isGateHovered && !clickAreaRef.matches(':hover')) {
                        clickAreaRef.setAttribute('fill', 'transparent');
                        clickAreaRef.removeAttribute('stroke');
                        clickAreaRef.removeAttribute('stroke-width');
                        clickAreaRef.removeAttribute('stroke-dasharray');
                    }
                }, 50);
            }
        });
    };
    
    if (gate.Single) {
        const single = gate.Single;
        const qubit = single.qubit;
        const gateType = single.gate;
        const y = 40 + qubit * qubitSpacing;
        
        const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        box.setAttribute('class', 'gate-box');
        // Highlight gates that have been executed (time < currentTime)
        if (time < currentTime) {
            box.setAttribute('class', 'gate-box gate-highlighted');
        }
        box.setAttribute('x', x - 15);
        box.setAttribute('y', y - 15);
        box.setAttribute('width', '30');
        box.setAttribute('height', '30');
        addGateInteractivity(box, qubit);
        svg.appendChild(box);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'gate-symbol');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.textContent = gateType === 'Sdg' ? 'S†' : gateType;
        addGateInteractivity(text, qubit);
        svg.appendChild(text);
    } else if (gate.Two) {
        const twoGate = gate.Two;
        if (twoGate.CNOT) {
            const cnot = twoGate.CNOT;
            const control = cnot.control;
            const target = cnot.target;
            const yControl = 40 + control * qubitSpacing;
            const yTarget = 40 + target * qubitSpacing;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'qubit-line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', yControl);
            line.setAttribute('x2', x);
            line.setAttribute('y2', yTarget);
            line.setAttribute('stroke-width', '2');
            // Make line interactive (clicking anywhere on the CNOT line works)
            addGateInteractivity(line, control); // Use control qubit as primary
            svg.appendChild(line);
            
            const controlDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            controlDot.setAttribute('cx', x);
            controlDot.setAttribute('cy', yControl);
            controlDot.setAttribute('r', '5');
            controlDot.setAttribute('fill', '#7AB9E5');
            addGateInteractivity(controlDot, control);
            svg.appendChild(controlDot);
            
            const targetBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            // Highlight gates that have been executed (time < currentTime)
            if (time < currentTime) {
                targetBox.setAttribute('class', 'gate-box gate-highlighted');
            } else {
            targetBox.setAttribute('class', 'gate-box');
            }
            targetBox.setAttribute('x', x - 15);
            targetBox.setAttribute('y', yTarget - 15);
            targetBox.setAttribute('width', '30');
            targetBox.setAttribute('height', '30');
            addGateInteractivity(targetBox, target);
            svg.appendChild(targetBox);
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'gate-symbol');
            text.setAttribute('x', x);
            text.setAttribute('y', yTarget);
            text.textContent = '⊕';
            addGateInteractivity(text, target);
            svg.appendChild(text);
        } else if (twoGate.CZ) {
            const cz = twoGate.CZ;
            const control = cz.control;
            const target = cz.target;
            const yControl = 40 + control * qubitSpacing;
            const yTarget = 40 + target * qubitSpacing;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'qubit-line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', yControl);
            line.setAttribute('x2', x);
            line.setAttribute('y2', yTarget);
            line.setAttribute('stroke-width', '2');
            addGateInteractivity(line, control); // Use control qubit as primary
            svg.appendChild(line);
            
            [yControl, yTarget].forEach((y, idx) => {
                const qubit = idx === 0 ? control : target;
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', x);
                dot.setAttribute('cy', y);
                dot.setAttribute('r', '5');
                dot.setAttribute('fill', '#7AB9E5');
                addGateInteractivity(dot, qubit);
                svg.appendChild(dot);
            });
        } else if (twoGate.SWAP) {
            const swap = twoGate.SWAP;
            const q1 = swap.qubit1;
            const q2 = swap.qubit2;
            const y1 = 40 + q1 * qubitSpacing;
            const y2 = 40 + q2 * qubitSpacing;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'qubit-line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke-width', '2');
            addGateInteractivity(line, q1); // Use first qubit as primary
            svg.appendChild(line);
            
            [y1, y2].forEach((y, idx) => {
                const qubit = idx === 0 ? q1 : q2;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'gate-symbol');
                text.setAttribute('x', x);
                text.setAttribute('y', y);
                text.textContent = '×';
                addGateInteractivity(text, qubit);
                svg.appendChild(text);
            });
        }
    }
}

function renderError(svg, error, qubit, time, spacing, qubitSpacing, startX) {
    const x = 60;
    const y = 40 + qubit * qubitSpacing;
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', `error-indicator error-${error.toLowerCase()}`);
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.textContent = error;
    svg.appendChild(text);
}

function handleCircuitClick(event) {
    const qubit = parseInt(event.target.getAttribute('data-qubit'));
    const time = parseInt(event.target.getAttribute('data-time'));
    
    if (selectedGate) {
        // Always place at the clicked time slot
        placeGate(qubit, time, selectedGate);
    }
}

function handleCircuitRightClick(event) {
    event.preventDefault(); // Prevent context menu
    const qubit = parseInt(event.target.getAttribute('data-qubit'));
    const time = parseInt(event.target.getAttribute('data-time'));
    
    removeGate(qubit, time);
}

function removeGate(qubit, time) {
    try {
        const hadError = initialError !== null && Object.keys(initialError).length > 0;
        // Deep copy initialError to ensure it's not modified
        const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
        
        const gates = circuit.get_gates();
        if (!Array.isArray(gates)) {
            console.error('Gates is not an array');
            return;
        }
        
        // Find the gate at this time step that uses this qubit
        let gateToRemoveIndex = -1;
        for (let i = 0; i < gates.length; i++) {
            const gateTime = gateTimePositions.get(i);
            if (gateTime === time) {
                const gate = gates[i];
                let gateQubits = [];
                if (gate.Single) {
                    gateQubits = [gate.Single.qubit];
                } else if (gate.Two) {
                    if (gate.Two.CNOT) {
                        gateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                    } else if (gate.Two.CZ) {
                        gateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                    } else if (gate.Two.SWAP) {
                        gateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                    }
                }
                
                // Check if this gate uses the clicked qubit
                if (gateQubits.includes(qubit)) {
                    gateToRemoveIndex = i;
                    break;
                }
            }
        }
        
        // If no gate found, nothing to remove
        if (gateToRemoveIndex === -1) {
            return;
        }
        
        // Remove the gate and rebuild circuit
        const newCircuit = new WasmCircuit(circuit.num_qubits());
        const gatesToKeep = gates.filter((g, idx) => idx !== gateToRemoveIndex);
        
        // Preserve time positions for remaining gates (shift indices)
        const newGateTimePositions = new Map();
        gates.forEach((g, idx) => {
            if (idx < gateToRemoveIndex) {
                // Gates before removed gate keep their index and time
                const oldTime = gateTimePositions.get(idx);
                if (oldTime !== undefined) {
                    newGateTimePositions.set(idx, oldTime);
                }
            } else if (idx > gateToRemoveIndex) {
                // Gates after removed gate shift index down by 1, but keep their time
                const oldTime = gateTimePositions.get(idx);
                if (oldTime !== undefined) {
                    newGateTimePositions.set(idx - 1, oldTime);
                }
            }
            // Skip the removed gate (idx === gateToRemoveIndex)
        });
        gateTimePositions = newGateTimePositions;
        
        // Rebuild circuit with remaining gates
        gatesToKeep.forEach(gate => {
            if (gate.Single) {
                newCircuit.add_single_gate(gate.Single.qubit, gate.Single.gate);
            } else if (gate.Two) {
                if (gate.Two.CNOT) {
                    newCircuit.add_cnot(gate.Two.CNOT.control, gate.Two.CNOT.target);
                } else if (gate.Two.CZ) {
                    newCircuit.add_cz(gate.Two.CZ.control, gate.Two.CZ.target);
                } else if (gate.Two.SWAP) {
                    newCircuit.add_swap(gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2);
                }
            }
        });
        
        circuit = newCircuit;
        simulator = new WasmSimulator(circuit);
        currentTime = simulator.current_time();
        
        // Restore error state if it existed
        if (hadError && savedError) {
            initialError = savedError;
            Object.keys(savedError).forEach(q => {
                const errorType = savedError[q];
                simulator.inject_error(parseInt(q), errorType);
            });
        } else {
            initialError = null;
        }
        
        // Reset simulation state
        currentTime = 0;
        errorHistory = [];
        previousCircuitDepth = 0;
        
        // Don't clear gate time positions - they're already updated above
        // This preserves the time slots, leaving the removed gate's position empty
        
        // Render with preserved time positions
        renderCircuit();
        updateDisplay();
    } catch (err) {
        console.error('Failed to remove gate:', err);
    }
}

function calculateGateTimeSlots(gates) {
    const timeSlots = [];
    const qubitLastTime = new Map();
    
    gates.forEach((gate, idx) => {
        let qubits = [];
        if (gate.Single) {
            qubits = [gate.Single.qubit];
        } else if (gate.Two) {
            if (gate.Two.CNOT) {
                qubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
            } else if (gate.Two.CZ) {
                qubits = [gate.Two.CZ.control, gate.Two.CZ.target];
            } else if (gate.Two.SWAP) {
                qubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
            }
        }
        
        let maxTime = -1;
        qubits.forEach(q => {
            const lastTime = qubitLastTime.get(q) || -1;
            maxTime = Math.max(maxTime, lastTime);
        });
        
        const timeSlot = maxTime + 1;
        qubits.forEach(q => {
            qubitLastTime.set(q, timeSlot);
        });
        
        timeSlots.push(timeSlot);
    });
    
    return { timeSlots, qubitLastTime };
}

function getNextAvailableTimeSlot(qubit, gateType) {
    // Calculate the next available time slot for a gate on the given qubit(s)
    // This finds the maximum time slot where the qubit(s) have a gate, then returns +1
    let maxTime = -1;
    
    // Determine which qubits will be used by the gate
    let gateQubits = [];
    if (gateType === 'CNOT') {
        const target = (qubit + 1) % circuit.num_qubits();
        gateQubits = [qubit, target];
    } else if (gateType === 'CZ') {
        const target = (qubit + 1) % circuit.num_qubits();
        gateQubits = [qubit, target];
    } else if (gateType === 'SWAP') {
        const qubit2 = (qubit + 1) % circuit.num_qubits();
        gateQubits = [qubit, qubit2];
    } else {
        gateQubits = [qubit];
    }
    
    const gates = circuit.get_gates();
    gates.forEach((gate, idx) => {
        const gateTime = gateTimePositions.get(idx);
        if (gateTime !== undefined) {
            let existingGateQubits = [];
            if (gate.Single) {
                existingGateQubits = [gate.Single.qubit];
            } else if (gate.Two) {
                if (gate.Two.CNOT) {
                    existingGateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                } else if (gate.Two.CZ) {
                    existingGateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                } else if (gate.Two.SWAP) {
                    existingGateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                }
            }
            
            // If this gate uses any of the qubits we need, check its time slot
            if (gateQubits.some(q => existingGateQubits.includes(q))) {
                maxTime = Math.max(maxTime, gateTime);
            }
        }
    });
    
    return maxTime + 1;
}

function placeGateAtNextTimeSlot(qubit, gateType) {
    // Place a gate at the next available time slot for the qubit(s)
    // This is useful for programmatically adding gates and expanding the circuit
    const nextTime = getNextAvailableTimeSlot(qubit, gateType);
    placeGate(qubit, nextTime, gateType);
}

function placeGate(qubit, time, gateType) {
    try {
        const hadError = initialError !== null && Object.keys(initialError).length > 0;
        // Deep copy initialError to ensure it's not modified
        const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
        
        const beforePattern = simulator ? simulator.get_error_pattern().to_string() : 'N/A';
        const beforePhase = simulator ? simulator.get_error_pattern().get_phase() : '';
        
        const gates = circuit.get_gates();
        if (!Array.isArray(gates)) {
            console.error('Gates is not an array');
            return;
        }
        
        // Determine which qubits will be used by the new gate
        let newGateQubits = [];
        if (gateType === 'CNOT') {
            const target = (qubit + 1) % circuit.num_qubits();
            newGateQubits = [qubit, target];
        } else if (gateType === 'CZ') {
            const target = (qubit + 1) % circuit.num_qubits();
            newGateQubits = [qubit, target];
        } else if (gateType === 'SWAP') {
            const qubit2 = (qubit + 1) % circuit.num_qubits();
            newGateQubits = [qubit, qubit2];
        } else {
            newGateQubits = [qubit];
        }
        
        // Find ALL existing gates at this time step that conflict with the new gate
        const conflictingGates = []; // Array of { index, gate, qubits }
        
        for (let i = 0; i < gates.length; i++) {
            const gateTime = gateTimePositions.get(i);
            if (gateTime === time) {
                const gate = gates[i];
                let gateQubits = [];
                if (gate.Single) {
                    gateQubits = [gate.Single.qubit];
                } else if (gate.Two) {
                    if (gate.Two.CNOT) {
                        gateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                    } else if (gate.Two.CZ) {
                        gateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                    } else if (gate.Two.SWAP) {
                        gateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                    }
                }
                
                // Check if this gate uses any of the qubits we want to place the new gate on
                if (newGateQubits.some(q => gateQubits.includes(q))) {
                    conflictingGates.push({ index: i, gate, qubits: gateQubits });
                }
            }
        }
        
        // If we found conflicting gates, check if we can replace them
        if (conflictingGates.length > 0) {
            // Collect all qubits covered by conflicting gates
            const coveredQubits = new Set();
            conflictingGates.forEach(({ qubits }) => {
                qubits.forEach(q => coveredQubits.add(q));
            });
            
            // Check if the conflicting gates together cover ALL qubits needed by the new gate
            const allQubitsCovered = newGateQubits.every(q => coveredQubits.has(q));
            
            if (allQubitsCovered) {
                // Conflicting gates cover all qubits needed - we can replace ALL of them
                // This follows the "only 1 gate per qubit per time step" rule
                // Proceed to replace all conflicting gates
            } else {
                // Conflicting gates cover some qubits, but not all
                // Check if the remaining qubits are free (not occupied by other gates)
                const uncoveredQubits = newGateQubits.filter(q => !coveredQubits.has(q));
                const conflictingIndices = new Set(conflictingGates.map(cg => cg.index));
                
                // Check if any uncovered qubit is occupied by a non-conflicting gate
                for (let i = 0; i < gates.length; i++) {
                    if (conflictingIndices.has(i)) continue; // Skip gates we're already replacing
                    
                    const gateTime = gateTimePositions.get(i);
                    if (gateTime === time) {
                        const gate = gates[i];
                        let gateQubits = [];
                        if (gate.Single) {
                            gateQubits = [gate.Single.qubit];
                        } else if (gate.Two) {
                            if (gate.Two.CNOT) {
                                gateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                            } else if (gate.Two.CZ) {
                                gateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                            } else if (gate.Two.SWAP) {
                                gateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                            }
                        }
                        
                        // Check if this gate uses any of the uncovered qubits
                        if (uncoveredQubits.some(q => gateQubits.includes(q))) {
                            return; // Block placement - uncovered qubit is also occupied
                        }
                    }
                }
                // All uncovered qubits are free - we can replace the conflicting gates
            }
        } else {
            // No gate to replace, check for conflicts with any existing gates
            for (let i = 0; i < gates.length; i++) {
                const gateTime = gateTimePositions.get(i);
                if (gateTime === time) {
                    const gate = gates[i];
                    let gateQubits = [];
                    if (gate.Single) {
                        gateQubits = [gate.Single.qubit];
                    } else if (gate.Two) {
                        if (gate.Two.CNOT) {
                            gateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                        } else if (gate.Two.CZ) {
                            gateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                        } else if (gate.Two.SWAP) {
                            gateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                        }
                    }
                    
                    // Check if any qubit used by the new gate conflicts with existing gate
                    if (newGateQubits.some(q => gateQubits.includes(q))) {
                        return; // Block placement - conflict detected
                    }
                }
            }
        }
        
        // Create the new gate (no conflicts, safe to place)
        let newGate;
        if (gateType === 'CNOT') {
            const target = (qubit + 1) % circuit.num_qubits();
            newGate = { Two: { CNOT: { control: qubit, target } } };
        } else if (gateType === 'CZ') {
            const target = (qubit + 1) % circuit.num_qubits();
            newGate = { Two: { CZ: { control: qubit, target } } };
        } else if (gateType === 'SWAP') {
            const qubit2 = (qubit + 1) % circuit.num_qubits();
            newGate = { Two: { SWAP: { qubit1: qubit, qubit2 } } };
        } else {
            newGate = { Single: { qubit, gate: gateType } };
        }
        
        const newCircuit = new WasmCircuit(circuit.num_qubits());
        const gatesToInsert = [];
        const newGateTimePositions = new Map();
        
        if (conflictingGates.length > 0) {
            // Replace ALL conflicting gates with the new gate
            const conflictingIndices = new Set(conflictingGates.map(cg => cg.index));
            
            // Find the earliest position among conflicting gates for insertion
            const earliestConflictingIndex = Math.min(...conflictingGates.map(cg => cg.index));
            
            // Build new gates array: keep non-conflicting gates, insert new gate at earliest position
            let newIndex = 0;
            for (let oldIndex = 0; oldIndex < gates.length; oldIndex++) {
                if (!conflictingIndices.has(oldIndex)) {
                    // Keep this gate
                    gatesToInsert.push(gates[oldIndex]);
                    const oldTime = gateTimePositions.get(oldIndex);
                    if (oldTime !== undefined) {
                        newGateTimePositions.set(newIndex, oldTime);
                    }
                    newIndex++;
                } else if (oldIndex === earliestConflictingIndex) {
                    // Insert new gate at the position of the first conflicting gate
                    gatesToInsert.push(newGate);
                    newGateTimePositions.set(newIndex, time);
                    newIndex++;
                }
                // Skip other conflicting gates (they're being replaced)
            }
        } else {
            // Insert new gate (original behavior - no conflicts)
            gatesToInsert.push(...gates);
        let insertPosition = gates.length;
        const existingTimeSlots = new Map();
        gates.forEach((g, idx) => {
            const gTime = gateTimePositions.get(idx);
            if (gTime !== undefined) {
                existingTimeSlots.set(idx, gTime);
            }
        });
        
        for (let i = 0; i < gates.length; i++) {
            const gTime = existingTimeSlots.get(i);
            if (gTime !== undefined && gTime > time) {
                insertPosition = i;
                break;
            }
        }
        
        gatesToInsert.splice(insertPosition, 0, newGate);
        
        gatesToInsert.forEach((g, newIdx) => {
            if (newIdx < insertPosition) {
                const oldTime = gateTimePositions.get(newIdx);
                if (oldTime !== undefined) {
                    newGateTimePositions.set(newIdx, oldTime);
                }
            } else if (newIdx === insertPosition) {
                newGateTimePositions.set(newIdx, time);
            } else {
                const oldIdx = newIdx - 1;
                const oldTime = gateTimePositions.get(oldIdx);
                if (oldTime !== undefined) {
                    newGateTimePositions.set(newIdx, oldTime);
                }
            }
        });
        }
        
        gateTimePositions = newGateTimePositions;
        
        gatesToInsert.forEach(gate => {
            if (gate.Single) {
                newCircuit.add_single_gate(gate.Single.qubit, gate.Single.gate);
            } else if (gate.Two) {
                if (gate.Two.CNOT) {
                    newCircuit.add_cnot(gate.Two.CNOT.control, gate.Two.CNOT.target);
                } else if (gate.Two.CZ) {
                    newCircuit.add_cz(gate.Two.CZ.control, gate.Two.CZ.target);
                } else if (gate.Two.SWAP) {
                    newCircuit.add_swap(gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2);
                }
            }
        });
        
        circuit = newCircuit;
        simulator = new WasmSimulator(circuit);
        currentTime = simulator.current_time();
        
        const finalGates = circuit.get_gates();
        const gatesByTime = {};
        finalGates.forEach((g, idx) => {
            const time = gateTimePositions.get(idx);
            if (time !== undefined) {
                if (!gatesByTime[time]) gatesByTime[time] = [];
                gatesByTime[time].push({ index: idx, gate: g });
            }
        });
        
        if (hadError && savedError) {
            initialError = savedError;
            Object.keys(savedError).forEach(q => {
                const errorType = savedError[q];
                const beforePattern = simulator.get_error_pattern().to_string();
                const beforePhase = simulator.get_error_pattern().get_phase();
                simulator.inject_error(parseInt(q), errorType);
                const restoredPattern = simulator.get_error_pattern().to_string();
                const restoredPhase = simulator.get_error_pattern().get_phase();
            });
        }
        
        const afterPattern = simulator ? simulator.get_error_pattern().to_string() : 'N/A';
        const afterPhase = simulator ? simulator.get_error_pattern().get_phase() : '';
        const allGates = circuit.get_gates();
        
        // Keep the gate selected after placement so user can place multiple gates
        // Don't deselect - this allows placing parallel gates or multiple gates of same type
        renderCircuit();
        // Restore gate button active state after renderCircuit (which recreates the SVG but not buttons)
        if (selectedGate) {
            const gateBtn = document.querySelector(`.gate-btn[data-gate="${selectedGate}"]`);
            if (gateBtn) {
                gateBtn.classList.add('active');
            }
        }
        // Reset currentTime to 0 after gate placement since simulator is reset
        currentTime = 0;
        updateDisplay();
    } catch (err) {
        console.error('Failed to place gate:', err);
    }
}

function injectError(qubit) {
    if (selectedError && simulator) {
        try {
            if (!initialError) {
                initialError = {};
            }
            const previousPattern = simulator.get_error_pattern().to_string();
            const previousPhase = simulator.get_error_pattern().get_phase();
            const previousFullPattern = `${previousPhase}${previousPattern}`;
            
            // Check if this qubit already has an error
            const hadErrorOnQubit = initialError.hasOwnProperty(qubit.toString());
            const previousErrorOnQubit = initialError[qubit];
            
            initialError[qubit] = selectedError;
            simulator.inject_error(qubit, selectedError);
            const errorPattern = simulator.get_error_pattern();
            const phase = errorPattern.get_phase();
            const pattern = errorPattern.to_string();
            const fullPattern = `${phase}${pattern}`;
            // Don't update currentTime here - preserve the current time slot
            // simulator.current_time() returns gate index, not time slot
            // Error injection shouldn't change which time slot we're viewing
            updateDisplay();
            renderCircuit();
        } catch (e) {
            console.error('[ERROR] Error in injectError:', e, e.stack);
        }
    } else {
        console.warn('[WARN] Cannot inject error:', { selectedError, selectedErrorType: typeof selectedError, selectedErrorTruthy: !!selectedError, hasSimulator: !!simulator });
    }
}

function stepForward() {
    if (simulator && simulator.step_forward()) {
        currentTime = simulator.current_time();
        updateDisplay();
        renderCircuit();
    }
}

function stepBackward() {
    if (simulator && simulator.step_backward()) {
        currentTime = simulator.current_time();
        updateDisplay();
        renderCircuit();
    }
}

function reset() {
    if (circuit && WasmCircuit) {
        // Clear all errors when resetting
        circuit = new WasmCircuit(2);
        simulator = new WasmSimulator(circuit);
        initialError = null;
        selectedError = null;
        currentTime = 0;
        gateTimePositions.clear();
        errorHistory = [];
        previousCircuitDepth = 0; // Reset depth tracking
        
        if (window.updateErrorControls) {
            window.updateErrorControls();
        }
        document.querySelectorAll('.error-btn').forEach(btn => btn.classList.remove('active'));
        
        // Reset currentTime to 0 (time slot 0) after reset
        currentTime = 0;
        updateDisplay();
        renderCircuit();
        
        document.querySelectorAll('.gate-btn').forEach(btn => btn.classList.remove('active'));
        selectedGate = null;
    }
}

function recordErrorHistory(forceUpdate = false) {
    if (!simulator || !circuit) return;
    
    const errorPattern = simulator.get_error_pattern();
    const phase = errorPattern.get_phase();
    const pattern = errorPattern.to_string();
    
    // Only record history if we're at a new time slot (stepping forward)
    // or if forceUpdate is true (for initial display)
    // Don't overwrite existing history when stepping backward
    if (errorHistory.length <= currentTime || !errorHistory[currentTime] || forceUpdate) {
        if (errorHistory.length <= currentTime) {
            errorHistory.length = currentTime + 1;
        }
        errorHistory[currentTime] = { time: currentTime, pattern, phase };
    }
    
    renderErrorChart();
}

function renderErrorChart() {
    const chartContainer = document.getElementById('error-chart');
    if (!chartContainer || !circuit || errorHistory.length === 0) {
        if (chartContainer) {
            chartContainer.innerHTML = '<h3>Error Evolution</h3><div style="padding: 20px; color: #999; text-align: center; font-size: 0.85rem;">Step through the circuit to see error evolution</div>';
        }
        return;
    }
    
    const numQubits = circuit.num_qubits();
    const maxTime = getCircuitDepth();
    const width = 250;
    const height = 200;
    const legendHeight = 25;
    const timeLabelHeight = 20; // Space for time step labels below chart
    const padding = { top: 20, right: 10, bottom: legendHeight + timeLabelHeight + 10, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom - legendHeight - timeLabelHeight;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'error-chart-svg');
    
    const pauliToY = (pauli, qubit) => {
        const qubitHeight = chartHeight / numQubits;
        const baseY = padding.top + qubit * qubitHeight + qubitHeight / 2;
        const offset = { 'I': 0, 'X': -qubitHeight * 0.25, 'Y': 0, 'Z': qubitHeight * 0.25 };
        return baseY + (offset[pauli] || 0);
    };
    
    const pauliToColor = (pauli) => {
        const colors = { 'X': '#e65a6e', 'Y': '#6bc4a8', 'Z': '#e6c85a', 'I': '#bdc3c7' };
        return colors[pauli] || '#000';
    };
    
    for (let q = 0; q < numQubits; q++) {
        const y = padding.top + q * (chartHeight / numQubits) + (chartHeight / numQubits) / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padding.left);
        line.setAttribute('y1', y);
        line.setAttribute('x2', padding.left + chartWidth);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#e0e0e0');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        svg.appendChild(line);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', 5);
        label.setAttribute('y', y + 4);
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', '#666');
        label.textContent = `Q${q}`;
        svg.appendChild(label);
    }
    
    for (let t = 0; t <= maxTime; t++) {
        const x = padding.left + (maxTime > 0 ? (t / maxTime) * chartWidth : 0);
        const data = errorHistory[t];
        
        if (data) {
            const hasNegativePhase = data.phase === '-';
            for (let q = 0; q < numQubits; q++) {
                const pauli = data.pattern[q] || 'I';
                const y = pauliToY(pauli, q);
                const color = pauliToColor(pauli);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', t === currentTime ? '6' : '4');
                
                if (hasNegativePhase && pauli !== 'I') {
                    circle.setAttribute('fill', 'transparent');
                    circle.setAttribute('stroke', color);
                    circle.setAttribute('stroke-width', '2');
                } else {
                    circle.setAttribute('fill', color);
                }
                
                if (t === currentTime) {
                    circle.setAttribute('stroke', '#333');
                    circle.setAttribute('stroke-width', hasNegativePhase ? '3' : '2');
                }
                svg.appendChild(circle);
                
                if (hasNegativePhase && pauli !== 'I') {
                    const minus = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    minus.setAttribute('x', x);
                    minus.setAttribute('y', y + 3);
                    minus.setAttribute('font-size', '8');
                    minus.setAttribute('fill', color);
                    minus.setAttribute('text-anchor', 'middle');
                    minus.setAttribute('font-weight', 'bold');
                    minus.textContent = '-';
                    svg.appendChild(minus);
                }
            }
        }
    }
    
    for (let t = 0; t <= maxTime; t++) {
        if (t % Math.max(1, Math.floor(maxTime / 5)) === 0 || t === maxTime) {
            const x = padding.left + (maxTime > 0 ? (t / maxTime) * chartWidth : 0);
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x);
            tick.setAttribute('y1', padding.top + chartHeight);
            tick.setAttribute('x2', x);
            tick.setAttribute('y2', padding.top + chartHeight + 5);
            tick.setAttribute('stroke', '#999');
            tick.setAttribute('stroke-width', '1');
            svg.appendChild(tick);
            
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', padding.top + chartHeight + 20);
            label.setAttribute('font-size', '9');
            label.setAttribute('fill', '#666');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = t;
            svg.appendChild(label);
        }
    }
    
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const legendY = height - 20;
    const legendItems = [
        { label: 'X', color: '#e65a6e', x: 5 },
        { label: 'Y', color: '#6bc4a8', x: 35 },
        { label: 'Z', color: '#e6c85a', x: 65 },
        { label: 'I', color: '#bdc3c7', x: 95 },
    ];
    
    legendItems.forEach(item => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', item.x);
        circle.setAttribute('cy', legendY);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', item.color);
        legend.appendChild(circle);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', item.x + 8);
        text.setAttribute('y', legendY + 4);
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#666');
        text.textContent = item.label;
        legend.appendChild(text);
    });
    
    const phaseExample = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    phaseExample.setAttribute('cx', 130);
    phaseExample.setAttribute('cy', legendY);
    phaseExample.setAttribute('r', '4');
    phaseExample.setAttribute('fill', 'transparent');
    phaseExample.setAttribute('stroke', '#e65a6e');
    phaseExample.setAttribute('stroke-width', '2');
    legend.appendChild(phaseExample);
    
    const phaseLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    phaseLabel.setAttribute('x', 140);
    phaseLabel.setAttribute('y', legendY + 4);
    phaseLabel.setAttribute('font-size', '8');
    phaseLabel.setAttribute('fill', '#999');
    phaseLabel.textContent = '= -phase';
    legend.appendChild(phaseLabel);
    
    svg.appendChild(legend);
    
    chartContainer.innerHTML = '<h3>Error Evolution</h3>';
    chartContainer.appendChild(svg);
}

function generateExplanation() {
    if (!simulator || !circuit || currentTime === 0) return null;
    
    try {
        const timeline = simulator.get_timeline();
        if (!Array.isArray(timeline) || timeline.length < 2) return null;
        
        const currentSnapshot = timeline[currentTime];
        if (!currentSnapshot || currentSnapshot.gate_applied === null || currentSnapshot.gate_applied === undefined) return null;
        
        const prevSnapshot = timeline[currentTime - 1];
        if (!prevSnapshot) return null;
        
        const gateIndex = currentSnapshot.gate_applied;
        const gates = circuit.get_gates();
        if (!Array.isArray(gates) || gateIndex >= gates.length) return null;
        
        const gate = gates[gateIndex];
        const beforePattern = prevSnapshot.error_pattern;
        const afterPattern = currentSnapshot.error_pattern;
        
        let explanation = '';
        let gateName = '';
        let gateDesc = '';
        
        if (gate.Single) {
            const single = gate.Single;
            gateName = single.gate === 'Sdg' ? 'S†' : single.gate;
            gateDesc = `Gate ${gateName} on Q${single.qubit}`;
            
            const beforeQ = beforePattern[single.qubit] || 'I';
            const afterQ = afterPattern[single.qubit] || 'I';
            
            explanation = `Before: ${beforePattern}<br>${gateDesc}<br>After: ${afterPattern}`;
            
            if (beforeQ !== afterQ || beforePattern !== afterPattern) {
                if (single.gate === 'H') {
                    if (beforeQ === 'X' && afterQ === 'Z') {
                        explanation += '<br><br><strong>Rule:</strong> H X H† = Z';
                    } else if (beforeQ === 'Z' && afterQ === 'X') {
                        explanation += '<br><br><strong>Rule:</strong> H Z H† = X';
                    } else if (beforeQ === 'Y' && afterQ === 'Y') {
                        explanation += '<br><br><strong>Rule:</strong> H Y H† = -Y';
                    }
                } else if (single.gate === 'S') {
                    if (beforeQ === 'X' && afterQ === 'Y') {
                        explanation += '<br><br><strong>Rule:</strong> S X S† = iY';
                    } else if (beforeQ === 'Y' && afterQ === 'X') {
                        explanation += '<br><br><strong>Rule:</strong> S Y S† = -X';
                    }
                } else if (single.gate === 'Sdg') {
                    if (beforeQ === 'X' && afterQ === 'Y') {
                        explanation += '<br><br><strong>Rule:</strong> S† X S = -iY';
                    } else if (beforeQ === 'Y' && afterQ === 'X') {
                        explanation += '<br><br><strong>Rule:</strong> S† Y S = X';
                    }
                }
            } else {
                explanation += '<br><br><strong>Note:</strong> Error pattern unchanged';
            }
        } else if (gate.Two) {
            const twoGate = gate.Two;
            if (twoGate.CNOT) {
                const cnot = twoGate.CNOT;
                gateName = 'CNOT';
                gateDesc = `CNOT(Q${cnot.control} → Q${cnot.target})`;
                
                const beforeC = beforePattern[cnot.control] || 'I';
                const beforeT = beforePattern[cnot.target] || 'I';
                const afterC = afterPattern[cnot.control] || 'I';
                const afterT = afterPattern[cnot.target] || 'I';
                
                explanation = `Before: ${beforePattern}<br>${gateDesc}<br>After: ${afterPattern}`;
                
                if (beforeC === 'X' && afterC === 'X' && afterT === 'X' && beforeT !== 'X') {
                    explanation += '<br><br><strong>Rule:</strong> X on control spreads to target';
                } else if (beforeT === 'Z' && afterC === 'Z' && afterT === 'Z' && beforeC !== 'Z') {
                    explanation += '<br><br><strong>Rule:</strong> Z on target spreads to control';
                } else if (beforeC === 'Z' && afterC === 'Z' && beforeT === afterT) {
                    explanation += '<br><br><strong>Rule:</strong> Z on control stays on control';
                } else if (beforePattern === afterPattern) {
                    explanation += '<br><br><strong>Note:</strong> Error pattern unchanged';
                } else if (beforePattern === afterPattern) {
                    explanation += '<br><br><strong>Note:</strong> Error pattern unchanged';
                }
            } else if (twoGate.CZ) {
                const cz = twoGate.CZ;
                gateName = 'CZ';
                gateDesc = `CZ(Q${cz.control}, Q${cz.target})`;
                
                explanation = `Before: ${beforePattern}<br>${gateDesc}<br>After: ${afterPattern}`;
                
                const beforeC = beforePattern[cz.control] || 'I';
                const afterT = afterPattern[cz.target] || 'I';
                if (beforeC === 'X' && afterT === 'Z') {
                    explanation += '<br><br><strong>Rule:</strong> X on control spreads Z to target';
                } else if (beforePattern === afterPattern) {
                    explanation += '<br><br><strong>Note:</strong> Error pattern unchanged';
                }
            } else if (twoGate.SWAP) {
                const swap = twoGate.SWAP;
                gateName = 'SWAP';
                gateDesc = `SWAP(Q${swap.qubit1}, Q${swap.qubit2})`;
                
                explanation = `Before: ${beforePattern}<br>${gateDesc}<br>After: ${afterPattern}`;
                if (beforePattern === afterPattern) {
                    explanation += '<br><br><strong>Note:</strong> Error pattern unchanged (both qubits had same error or both I)';
                } else {
                    explanation += '<br><br><strong>Rule:</strong> Errors swap between qubits';
                }
            }
        }
        
        return explanation || null;
    } catch (e) {
        console.error('Error generating explanation:', e);
        return null;
    }
}

function updateDisplay() {
    if (!simulator) return;
    
    // Don't update currentTime here - it should be set by the caller
    // simulator.current_time() returns gate index, not time slot
    // stepToTime sets currentTime to the time slot, so we shouldn't overwrite it
    const errorPattern = simulator.get_error_pattern();
    const phase = errorPattern.get_phase();
    const pattern = errorPattern.to_string();
    const fullPattern = `${phase}${pattern}`;
    
    const circuitGates = circuit ? circuit.get_gates() : [];
    const gateAtCurrentTime = currentTime > 0 && currentTime <= circuitGates.length ? circuitGates[currentTime - 1] : null;
    recordErrorHistory(true); // Force update for display
    
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        const explanation = generateExplanation();
        errorDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <h3 style="margin: 0;">Error Pattern</h3>
                ${explanation ? `
                    <span class="info-tooltip" style="position: relative; cursor: help;">
                        <span style="font-size: 0.9rem; color: #666; border: 1px solid #ccc; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; background: #f0f0f0;">?</span>
                        <span class="tooltip-text" style="visibility: hidden; width: 200px; background-color: #f5f5f5; color: #333; text-align: left; border-radius: 6px; padding: 8px; position: absolute; z-index: 1000; bottom: 125%; left: 50%; margin-left: -100px; font-size: 0.75rem; line-height: 1.4; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #ddd;">
                            ${explanation}
                            <span style="position: absolute; top: 100%; left: 50%; margin-left: -5px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #f5f5f5;"></span>
                        </span>
                    </span>
                ` : ''}
            </div>
            <div class="error-pattern">${phase}${pattern}</div>
        `;
        
        if (explanation) {
            const tooltip = errorDisplay.querySelector('.info-tooltip');
            const tooltipText = errorDisplay.querySelector('.tooltip-text');
            if (tooltip && tooltipText) {
                tooltip.addEventListener('mouseenter', () => {
                    tooltipText.style.visibility = 'visible';
                });
                tooltip.addEventListener('mouseleave', () => {
                    tooltipText.style.visibility = 'hidden';
                });
            }
        }
    }
    
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
        timeDisplay.innerHTML = `<h3>Time</h3><div class="time-info">${currentTime} / ${getCircuitDepth()}</div>`;
    }
    
    if (window.updateStepControls) {
        window.updateStepControls();
    }
}

initApp().catch(console.error);

