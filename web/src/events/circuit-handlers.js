// Circuit click event handlers for Konva
import { selectedGate, pendingTwoQubitGate, setPendingTwoQubitGate } from '../state.js';
import { placeGate, placeTwoQubitGate } from '../components/gate-manager.js';
import { removeGate } from '../components/gate-manager.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';

export function handleCircuitClick(data) {
    // Can be called with either Konva event or plain object
    let qubit, time;
    
    if (data.evt) {
        // Konva event - get data from node attributes
        const node = data.target;
        qubit = parseInt(node.getAttr('data-qubit'));
        time = parseInt(node.getAttr('data-time'));
    } else {
        // Plain object (from click area)
        qubit = data.qubit;
        time = data.time;
    }
    
    if (qubit === undefined || time === undefined) {
        return;
    }
    
    // Check if we have a pending two-qubit gate (first click already done)
    if (pendingTwoQubitGate) {
        // Second click: place the two-qubit gate
        const { controlQubit, gateType } = pendingTwoQubitGate;
        
        // Don't allow same qubit for control and target
        if (qubit === controlQubit) {
            // Cancel selection if clicking same qubit
            setPendingTwoQubitGate(null);
            renderCircuit(); // Clear highlight
            return;
        }
        
        // Place the two-qubit gate with specified control and target
        placeTwoQubitGate(controlQubit, qubit, time, gateType);
        
        // Clear pending state
        setPendingTwoQubitGate(null);
        renderCircuit(); // Clear highlight
        return;
    }
    
    // Check if selected gate is a two-qubit gate that needs two clicks
    if (selectedGate && (selectedGate === 'CNOT' || selectedGate === 'CZ' || selectedGate === 'SWAP')) {
        // First click: select control qubit
        setPendingTwoQubitGate({ controlQubit: qubit, gateType: selectedGate });
        renderCircuit(); // Show highlight
        return;
    }
    
    // Single-qubit gate or no pending state: place gate normally
    if (selectedGate) {
        placeGate(qubit, time, selectedGate);
    }
}

export function handleCircuitRightClick(data) {
    // Can be called with either Konva event or plain object
    let qubit, time;
    
    if (data.evt) {
        // Konva event
        data.evt.preventDefault(); // Prevent context menu
        const node = data.target;
        qubit = parseInt(node.getAttr('data-qubit'));
        time = parseInt(node.getAttr('data-time'));
    } else {
        // Plain object (from click area)
        qubit = data.qubit;
        time = data.time;
    }
    
    if (qubit !== undefined && time !== undefined) {
        removeGate(qubit, time);
    }
}
