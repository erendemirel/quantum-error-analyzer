// Gate placement and removal logic
import { circuit, simulator, setCircuit, setSimulator, selectedGate, initialError, setInitialError, setCurrentTime, gateTimePositions, errorHistory, setPreviousCircuitDepth, setLastPlacedGateTime } from '../state.js';
import { WasmCircuit, WasmSimulator } from '../wasm-loader.js';
import { getNextAvailableTimeSlot } from './time-scheduler.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { updateDisplay } from '../main.js';

// New function for placing two-qubit gates with explicit control and target
export function placeTwoQubitGate(controlQubit, targetQubit, time, gateType) {
    try {
        const hadError = initialError !== null && Object.keys(initialError).length > 0;
        const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
        
        if (!circuit) {
            console.error('No circuit available');
            return;
        }
        
        const gates = circuit.get_gates();
        if (!Array.isArray(gates)) {
            console.error('Gates is not an array');
            return;
        }
        
        // Determine which qubits will be used by the new gate
        let newGateQubits = [];
        if (gateType === 'CNOT') {
            newGateQubits = [controlQubit, targetQubit];
        } else if (gateType === 'CZ') {
            newGateQubits = [controlQubit, targetQubit];
        } else if (gateType === 'SWAP') {
            newGateQubits = [controlQubit, targetQubit];
        } else {
            console.error('Invalid two-qubit gate type:', gateType);
            return;
        }
        
        // Find ALL existing gates at this time step that conflict with the new gate
        const conflictingGates = [];
        
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
                
                if (newGateQubits.some(q => gateQubits.includes(q))) {
                    conflictingGates.push({ index: i, gate, qubits: gateQubits });
                }
            }
        }
        
        // Handle conflicts: Always replace conflicting gates
        // Rule: If ANY qubit of the new gate conflicts with existing gates, replace those gates
        // This reflects real physics: only one gate can act on a qubit per time step
        // Example: CNOT(q1,q4) exists, placing CZ(q1,q3) replaces CNOT with CZ
        // The conflicting gates will be removed and the new gate will be placed
        if (conflictingGates.length > 0) {
            // Always replace conflicting gates - standard behavior
            // This merges the old "adjacent qubit replacement" rule with the general conflict rule
        }
        
        // Create the new gate
        let newGate;
        if (gateType === 'CNOT') {
            newGate = { Two: { CNOT: { control: controlQubit, target: targetQubit } } };
        } else if (gateType === 'CZ') {
            newGate = { Two: { CZ: { control: controlQubit, target: targetQubit } } };
        } else if (gateType === 'SWAP') {
            newGate = { Two: { SWAP: { qubit1: controlQubit, qubit2: targetQubit } } };
        }
        
        // Rest of the placement logic (preserve original order, like placeGate)
        const newCircuit = new WasmCircuit(circuit.num_qubits());
        const gatesToInsert = [];
        const newGateTimePositions = new Map();
        
        // If there are no conflicts, we could optimize by cloning, but rebuilding is simpler
        // and consistent. Rebuilding is necessary when there are conflicts anyway.
        
        // Collect all gates except conflicting ones, preserving original order
        for (let i = 0; i < gates.length; i++) {
            if (!conflictingGates.some(cg => cg.index === i)) {
                gatesToInsert.push(gates[i]);
                const oldTime = gateTimePositions.get(i);
                if (oldTime !== undefined) {
                    newGateTimePositions.set(gatesToInsert.length - 1, oldTime);
                }
            }
        }
        
        // Add the new gate at the end (order doesn't matter for WASM circuit)
        gatesToInsert.push(newGate);
        const newGateIndex = gatesToInsert.length - 1;
        newGateTimePositions.set(newGateIndex, time);
        
        // Rebuild circuit: Add all gates to the new circuit
        // Note: Rebuilding is necessary when there are conflicts (no remove_gate() API).
        // When there are no conflicts, we could clone+add, but rebuilding is simpler and
        // consistent. The performance difference is negligible for typical circuit sizes.
        gatesToInsert.forEach((gate, idx) => {
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
        
        // Update gateTimePositions - indices match gatesToInsert order
        gateTimePositions.clear();
        newGateTimePositions.forEach((time, idx) => {
            gateTimePositions.set(idx, time);
        });
        
        // Restore error if it existed
        if (hadError && savedError) {
            setInitialError(savedError);
            Object.keys(savedError).forEach(q => {
                const qubitIndex = parseInt(q);
                const pauli = savedError[q];
                newSimulator.inject_error(qubitIndex, pauli);
            });
        }
        
        setCurrentTime(0);
        setPreviousCircuitDepth(0);
        setLastPlacedGateTime(time);
        
        renderCircuit();
        updateDisplay();
    } catch (error) {
        console.error('Error placing two-qubit gate:', error);
        alert(`Failed to place ${gateType} gate: ${error.message || error}`);
    }
}

export function placeGateAtNextTimeSlot(qubit, gateType) {
    // Place a gate at the next available time slot for the qubit(s)
    // This is useful for programmatically adding gates and expanding the circuit
    // For two-qubit gates, uses adjacent qubit logic for backward compatibility with tests
    if (gateType === 'CNOT' || gateType === 'CZ' || gateType === 'SWAP') {
        const nextTime = getNextAvailableTimeSlot(qubit, gateType);
        let targetQubit;
        if (gateType === 'CNOT' || gateType === 'CZ') {
            targetQubit = (qubit + 1) % circuit.num_qubits();
        } else { // SWAP
            targetQubit = (qubit + 1) % circuit.num_qubits();
        }
        placeTwoQubitGate(qubit, targetQubit, nextTime, gateType);
    } else {
        const nextTime = getNextAvailableTimeSlot(qubit, gateType);
        placeGate(qubit, nextTime, gateType);
    }
}

export function placeGate(qubit, time, gateType) {
    try {
        const hadError = initialError !== null && Object.keys(initialError).length > 0;
        // Deep copy initialError to ensure it's not modified
        const savedError = initialError ? JSON.parse(JSON.stringify(initialError)) : null;
        
        const gates = circuit.get_gates();
        if (!Array.isArray(gates)) {
            console.error('Gates is not an array');
            return;
        }
        
        // Two-qubit gates should use placeTwoQubitGate instead
        if (gateType === 'CNOT' || gateType === 'CZ' || gateType === 'SWAP') {
            console.error(`placeGate called with two-qubit gate ${gateType}. Use placeTwoQubitGate instead.`);
            return;
        }
        
        // Determine which qubits will be used by the new gate (single-qubit gates only)
        const newGateQubits = [qubit];
        
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
        
        // If we found conflicting gates, replace them
        // Rule: If ANY qubit conflicts, replace all conflicting gates
        // This merges the old "adjacent qubit replacement" rule with the general conflict rule
        // This reflects real physics: only one gate can act on a qubit per time step
        // Example: CNOT(q1,q4) exists, placing CZ(q1,q3) replaces CNOT with CZ
        // Example: H(q1) exists, placing X(q1) replaces H with X
        // The conflicting gates will be removed and the new gate will be placed
        if (conflictingGates.length > 0) {
            // Always replace conflicting gates - standard behavior
        }
        
        // Create the new gate (single-qubit gates only)
        const newGate = { Single: { qubit, gate: gateType } };
        
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
        
        // Update gateTimePositions - we need to mutate the Map
        gateTimePositions.clear();
        newGateTimePositions.forEach((time, idx) => {
            gateTimePositions.set(idx, time);
        });
        
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
        
        setCircuit(newCircuit);
        const newSimulator = new WasmSimulator(newCircuit);
        setSimulator(newSimulator);
        setCurrentTime(newSimulator.current_time());
        
        if (hadError && savedError) {
            setInitialError(savedError);
            Object.keys(savedError).forEach(q => {
                const errorType = savedError[q];
                newSimulator.inject_error(parseInt(q), errorType);
            });
        }
        
        // Track where the gate was placed for auto-scroll logic
        setLastPlacedGateTime(time);
        
        // Keep the gate selected after placement so user can place multiple gates
        // Don't deselect - this allows placing parallel gates or multiple gates of same type
        renderCircuit();
        // Restore gate button active state after renderCircuit (which recreates the canvas but not buttons)
        if (selectedGate) {
            const gateBtn = document.querySelector(`.gate-btn[data-gate="${selectedGate}"]`);
            if (gateBtn) {
                gateBtn.classList.add('active');
            }
        }
        // Reset currentTime to 0 after gate placement since simulator is reset
        setCurrentTime(0);
        updateDisplay();
    } catch (err) {
        console.error('Failed to place gate:', err);
    }
}

export function removeGate(qubit, time) {
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
        
        // Update gateTimePositions
        gateTimePositions.clear();
        newGateTimePositions.forEach((time, idx) => {
            gateTimePositions.set(idx, time);
        });
        
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
        
        setCircuit(newCircuit);
        const newSimulator = new WasmSimulator(newCircuit);
        setSimulator(newSimulator);
        setCurrentTime(newSimulator.current_time());
        
        // Restore error state if it existed
        if (hadError && savedError) {
            setInitialError(savedError);
            Object.keys(savedError).forEach(q => {
                const errorType = savedError[q];
                newSimulator.inject_error(parseInt(q), errorType);
            });
        } else {
            setInitialError(null);
        }
        
        // Reset simulation state
        setCurrentTime(0);
        // errorHistory and previousCircuitDepth reset handled in state
        errorHistory.length = 0;
        setPreviousCircuitDepth(0);
        
        // Don't clear gate time positions - they're already updated above
        // This preserves the time slots, leaving the removed gate's position empty
        
        // Render with preserved time positions
        renderCircuit();
        updateDisplay();
    } catch (err) {
        console.error('Failed to remove gate:', err);
    }
}

