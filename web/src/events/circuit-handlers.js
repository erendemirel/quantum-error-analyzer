// Circuit click event handlers for Konva
import { selectedGate } from '../state.js';
import { placeGate } from '../components/gate-manager.js';
import { removeGate } from '../components/gate-manager.js';

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
    
    if (selectedGate && qubit !== undefined && time !== undefined) {
        // Always place at the clicked time slot
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
