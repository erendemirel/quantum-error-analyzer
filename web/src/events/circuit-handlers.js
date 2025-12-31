// Circuit click event handlers for Konva
import { selectedGate, pendingTwoQubitGate, setPendingTwoQubitGate } from '../state.js';
import { placeGate, placeTwoQubitGate } from '../components/gate-manager.js';
import { removeGate } from '../components/gate-manager.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { showNotification, clearNotification } from '../utils/notifications.js';

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
        const { controlQubit, controlTime, gateType } = pendingTwoQubitGate;
        
        // Don't allow same qubit for control and target
        if (qubit === controlQubit) {
            // Cancel selection if clicking same qubit
            setPendingTwoQubitGate(null);
            renderCircuit(); // Clear highlight
            return;
        }
        
        // Require both clicks to be at the same time step
        if (time !== controlTime) {
            // Show non-blocking error message and cancel placement
            showNotification(
                `Cannot place ${gateType} gate: control and target must be at the same time step. Control was clicked at time ${controlTime}, but target was clicked at time ${time}. Please click the target at time ${controlTime}.`,
                5000
            );
            // Keep the pending state so user can try again
            renderCircuit(); // Re-render to show the control time highlight
            return;
        }
        
        // Both clicks are at the same time step - place the gate
        placeTwoQubitGate(controlQubit, qubit, controlTime, gateType);
        
        // Clear any existing notification (e.g., from a previous failed attempt)
        clearNotification();
        
        // Clear pending state
        setPendingTwoQubitGate(null);
        renderCircuit(); // Clear highlight
        return;
    }
    
    // Check if selected gate is a two-qubit gate that needs two clicks
    if (selectedGate && (selectedGate === 'CNOT' || selectedGate === 'CZ' || selectedGate === 'SWAP')) {
        // First click: select control qubit and store its time
        setPendingTwoQubitGate({ controlQubit: qubit, controlTime: time, gateType: selectedGate });
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
