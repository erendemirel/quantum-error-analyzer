// Error injection and history tracking
import { simulator, circuit, selectedError, initialError, setInitialError, currentTime, errorHistory } from '../state.js';
import { renderErrorChart } from '../rendering/error-chart.js';
import { updateDisplay } from '../main.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';

export function injectError(qubit) {
    if (selectedError && simulator) {
        try {
            if (!initialError) {
                setInitialError({});
            }
            
            // Update initialError
            const newInitialError = initialError ? { ...initialError } : {};
            newInitialError[qubit] = selectedError;
            setInitialError(newInitialError);
            
            simulator.inject_error(qubit, selectedError);
            
            // Don't update currentTime here - preserve the current time slot
            // simulator.current_time() returns gate index, not time slot
            // Error injection shouldn't change which time slot we're viewing
            updateDisplay();
            renderCircuit();
        } catch (e) {
            console.error('[ERROR] Error in injectError:', e, e.stack);
        }
    } else {
        console.warn('[WARN] Cannot inject error:', { selectedError, selectedErrorType: typeof selectedError, selectedErrorTruthy: !!selectedError, hasSimulator: !!simulator });
    }
}

export function recordErrorHistory(forceUpdate = false) {
    if (!simulator || !circuit) return;
    
    const errorPattern = simulator.get_error_pattern();
    const phase = errorPattern.get_phase();
    const pattern = errorPattern.to_string();
    
    // Only record history if we're at a new time slot (stepping forward)
    // or if forceUpdate is true (for initial display)
    // Don't overwrite existing history when stepping backward
    if (errorHistory.length <= currentTime || !errorHistory[currentTime] || forceUpdate) {
        if (errorHistory.length <= currentTime) {
            errorHistory.length = currentTime + 1;
        }
        errorHistory[currentTime] = { time: currentTime, pattern, phase };
    }
    
    renderErrorChart();
}

