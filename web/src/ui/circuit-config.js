// Circuit configuration UI
import { circuit, setCircuit, setSimulator, initialError, setInitialError, setCurrentTime, setPreviousCircuitDepth, gateTimePositions, errorHistory } from '../state.js';
import { WasmCircuit, WasmSimulator } from '../wasm-loader.js';
import { setupErrorControls } from './error-controls.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { updateDisplay } from '../main.js';

export function setupCircuitConfig() {
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

export function changeQubitCount(newCount) {
    if (!circuit || newCount === circuit.num_qubits()) {
        return;
    }
    
    // Save current state
    const savedGates = Array.from(circuit.get_gates());
    const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
    
    // Save current gateTimePositions before clearing
    const savedGateTimePositions = new Map(gateTimePositions);
    
    // Filter out gates that are no longer valid (qubit indices out of range)
    // and build new gates array with valid gates, preserving their original order
    const validGates = [];
    const newGateTimePositions = new Map();
    
    savedGates.forEach((gate, oldIndex) => {
        let isValid = false;
        
        if (gate.Single) {
            isValid = gate.Single.qubit < newCount;
        } else if (gate.Two) {
            if (gate.Two.CNOT) {
                isValid = gate.Two.CNOT.control < newCount && gate.Two.CNOT.target < newCount;
            } else if (gate.Two.CZ) {
                isValid = gate.Two.CZ.control < newCount && gate.Two.CZ.target < newCount;
            } else if (gate.Two.SWAP) {
                isValid = gate.Two.SWAP.qubit1 < newCount && gate.Two.SWAP.qubit2 < newCount;
            }
        }
        
        if (isValid) {
            const newIndex = validGates.length;
            validGates.push(gate);
            
            // Preserve the original time position
            const originalTime = savedGateTimePositions.get(oldIndex);
            if (originalTime !== undefined) {
                newGateTimePositions.set(newIndex, originalTime);
            }
        }
    });
    
    // Create new circuit with new qubit count
    const newCircuit = new WasmCircuit(newCount);
    
    // Add valid gates to circuit in their original order
    // The order doesn't matter for the circuit itself, but we'll preserve it
    validGates.forEach(gate => {
        try {
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
        } catch (e) {
            console.warn('Skipping gate due to qubit count change:', e);
        }
    });
    
    setCircuit(newCircuit);
    const newSimulator = new WasmSimulator(newCircuit);
    setSimulator(newSimulator);
    
    // Restore errors if qubits are still valid
    // initialError is stored as {qubit: errorType} object
    if (savedError && Object.keys(savedError).length > 0) {
        const newInitialError = {};
        Object.keys(savedError).forEach(q => {
            const qubit = parseInt(q);
            if (qubit < newCount) {
                newInitialError[q] = savedError[q];
                newSimulator.inject_error(qubit, savedError[q]);
            }
        });
        // If no errors were valid, clear initialError
        if (Object.keys(newInitialError).length === 0) {
            setInitialError(null);
        } else {
            setInitialError(newInitialError);
        }
    } else {
        setInitialError(null);
    }
    
    // Restore gateTimePositions with new indices
    // validGates preserves the order of gates that were kept
    // newGateTimePositions maps old valid indices to their time positions
    // We need to map these to the new circuit indices (which are just 0, 1, 2, ...)
    gateTimePositions.clear();
    newGateTimePositions.forEach((time, validIndex) => {
        // validIndex is the index in the validGates array
        // which corresponds directly to the new circuit index
        gateTimePositions.set(validIndex, time);
    });
    
    // Reset simulation state
    setCurrentTime(0);
    setPreviousCircuitDepth(0);
    errorHistory.length = 0;
    
    // Update UI
    const qubitCountInput = document.getElementById('qubit-count-input');
    if (qubitCountInput) {
        qubitCountInput.value = newCount;
    }
    setupErrorControls(); // Update qubit selector
    renderCircuit();
    updateDisplay();
}

