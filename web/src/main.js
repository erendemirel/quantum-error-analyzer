// Entry point - initialization and coordination
import { loadWasm, WasmCircuit, WasmSimulator } from './wasm-loader.js';
import { 
    circuit, simulator, selectedGate, setCircuit, setSimulator, setSelectedGate,
    currentTime, setCurrentTime, previousCircuitDepth, setPreviousCircuitDepth,
    gateTimePositions, errorHistory, setPendingTwoQubitGate
} from './state.js';
import { setupCircuitConfig, changeQubitCount } from './ui/circuit-config.js';
import { setupGatePalette } from './ui/gate-palette.js';
import { setupErrorControls } from './ui/error-controls.js';
import { setupSimulationControls } from './ui/simulation-controls.js';
import { renderCircuit, updateTimeSeparators } from './rendering/circuit-renderer.js';
import { getCircuitDepth } from './components/time-scheduler.js';
import { recordErrorHistory } from './components/error-handler.js';
import { handleCircuitClick } from './events/circuit-handlers.js';

async function initApp() {
    const wasmLoaded = await loadWasm();
    
    if (!wasmLoaded || !WasmCircuit) {
        return;
    }
    
    const newCircuit = new WasmCircuit(2);
    const newSimulator = new WasmSimulator(newCircuit);
    setCircuit(newCircuit);
    setSimulator(newSimulator);
    
    setupCircuitConfig();
    setupGatePalette();
    setupErrorControls();
    setupSimulationControls();
    // Initialize currentTime to 0 (time slot 0)
    setCurrentTime(0);
    setPreviousCircuitDepth(0); // Initialize depth tracking for auto-scroll
    // Update qubit count input to reflect current circuit
    const qubitCountInput = document.getElementById('qubit-count-input');
    if (qubitCountInput) {
        qubitCountInput.value = newCircuit.num_qubits();
    }
    renderCircuit();
    updateDisplay();
    
    // Expose handleCircuitClick for testing
    window.handleCircuitClick = handleCircuitClick;
    
    // Update circuit on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderCircuit();
            updateTimeSeparators();
        }, 100);
    });
    
    // Handle ESC key to cancel pending two-qubit gate selection
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setPendingTwoQubitGate(null);
            renderCircuit(); // Clear highlight
        }
    });
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

export function updateDisplay() {
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
