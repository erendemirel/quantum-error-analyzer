// Simulation controls UI
import { circuit, currentTime, gateTimePositions, simulator } from '../state.js';
import { getCircuitDepth } from '../components/time-scheduler.js';
import { stepToTime } from '../components/simulator.js';
import { reset } from '../components/simulator.js';
import { placeGate, placeGateAtNextTimeSlot } from '../components/gate-manager.js';
import { updateTimeSeparators } from '../rendering/circuit-renderer.js';

export function setupSimulationControls() {
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

