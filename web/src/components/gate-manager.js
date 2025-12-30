// Gate placement and removal logic
import { circuit, simulator, setCircuit, setSimulator, selectedGate, initialError, setInitialError, setCurrentTime, gateTimePositions, errorHistory, setPreviousCircuitDepth, setLastPlacedGateTime } from '../state.js';
import { WasmCircuit, WasmSimulator } from '../wasm-loader.js';
import { getNextAvailableTimeSlot } from './time-scheduler.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { updateDisplay } from '../main.js';

export function placeGateAtNextTimeSlot(qubit, gateType) {
    // Place a gate at the next available time slot for the qubit(s)
    // This is useful for programmatically adding gates and expanding the circuit
    const nextTime = getNextAvailableTimeSlot(qubit, gateType);
    placeGate(qubit, nextTime, gateType);
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

