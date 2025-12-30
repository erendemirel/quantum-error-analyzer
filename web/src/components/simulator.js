// Simulation logic - step forward/backward, reset
import { circuit, simulator, setCircuit, setSimulator, currentTime, setCurrentTime, initialError, setInitialError, selectedError, setSelectedError, gateTimePositions, errorHistory, setPreviousCircuitDepth, setSelectedGate } from '../state.js';
import { WasmCircuit, WasmSimulator } from '../wasm-loader.js';
import { getCircuitDepth } from './time-scheduler.js';
import { recordErrorHistory } from './error-handler.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { updateDisplay } from '../main.js';

export function stepToTime(targetTime) {
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
        const newCircuit = new WasmCircuit(numQubits);
        savedGates.forEach(gate => {
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
        const newSimulator = new WasmSimulator(newCircuit);
        setCircuit(newCircuit);
        setSimulator(newSimulator);
        if (savedError) {
            Object.keys(savedError).forEach(q => {
                newSimulator.inject_error(parseInt(q), savedError[q]);
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
            while (newSimulator.current_time() <= maxGateIndexAtTimeSlot) {
                const nextGateIndex = newSimulator.current_time();
                const nextGateTime = gateTimePositions.get(nextGateIndex);
                if (nextGateTime === currentTimeSlot) {
                    if (!newSimulator.step_forward()) break;
                } else if (nextGateTime < currentTimeSlot) {
                    if (!newSimulator.step_forward()) break;
                } else {
                    break;
                }
            }
            currentTimeSlot++;
        }
    }
    
    setCurrentTime(targetTime);
    updateDisplay();
    renderCircuit();
    
    // Update step controls
    if (window.updateStepControls) {
        window.updateStepControls();
    }
}

export function reset() {
    if (circuit && WasmCircuit) {
        // Clear all errors when resetting
        const newCircuit = new WasmCircuit(2);
        const newSimulator = new WasmSimulator(newCircuit);
        setCircuit(newCircuit);
        setSimulator(newSimulator);
        setInitialError(null);
        setSelectedError(null);
        setCurrentTime(0);
        gateTimePositions.clear();
        errorHistory.length = 0;
        setPreviousCircuitDepth(0);
        
        if (window.updateErrorControls) {
            window.updateErrorControls();
        }
        document.querySelectorAll('.error-btn').forEach(btn => btn.classList.remove('active'));
        
        // Reset currentTime to 0 (time slot 0) after reset
        setCurrentTime(0);
        updateDisplay();
        renderCircuit();
        
        document.querySelectorAll('.gate-btn').forEach(btn => btn.classList.remove('active'));
        setSelectedGate(null);
    }
}

