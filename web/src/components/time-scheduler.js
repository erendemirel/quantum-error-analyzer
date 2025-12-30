// Time slot calculation and scheduling
import { circuit, gateTimePositions } from '../state.js';

export function getCircuitDepth() {
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

export function calculateGateTimeSlots(gates) {
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

export function getNextAvailableTimeSlot(qubit, gateType) {
    // Calculate the next available time slot for a gate on the given qubit(s)
    // This finds the maximum time slot where the qubit(s) have a gate, then returns +1
    let maxTime = -1;
    
    // Determine which qubits will be used by the gate
    // For two-qubit gates, use adjacent qubit logic for backward compatibility
    let gateQubits = [];
    if (gateType === 'CNOT' || gateType === 'CZ') {
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

