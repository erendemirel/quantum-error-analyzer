// Error controls UI
import { circuit, simulator, selectedError, setSelectedError } from '../state.js';
import { injectError } from '../components/error-handler.js';

export function setupErrorControls() {
    const controls = document.getElementById('error-controls');
    controls.innerHTML = '<h3>Inject Error</h3><div class="qubit-selector"></div><div class="error-buttons"></div>';
    
    const qubitSelector = controls.querySelector('.qubit-selector');
    qubitSelector.innerHTML = '<label>Qubit: <select id="error-qubit-select"></select></label>';
    const qubitSelect = document.getElementById('error-qubit-select');
    
    const updateQubitOptions = () => {
        qubitSelect.innerHTML = '';
        const numQubits = circuit ? circuit.num_qubits() : 2;
        for (let q = 0; q < numQubits; q++) {
            const option = document.createElement('option');
            option.value = q;
            option.textContent = `Q${q}`;
            qubitSelect.appendChild(option);
        }
    };
    updateQubitOptions();
    
    const errorButtons = controls.querySelector('.error-buttons');
    errorButtons.innerHTML = '<label style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: #555;">Error:</label>';
    
    const errors = [
        { type: 'X', class: 'error-x', color: '#e65a6e' },
        { type: 'Y', class: 'error-y', color: '#6bc4a8' },
        { type: 'Z', class: 'error-z', color: '#e6c85a' },
        { type: 'I', class: 'error-i', color: '#bdc3c7' },
    ];
    
    errors.forEach(err => {
        const btn = document.createElement('button');
        btn.className = `error-btn ${err.class}`;
        btn.textContent = err.type;
        btn.dataset.error = err.type;
        btn.addEventListener('click', () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll('.error-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setSelectedError(err.type);
            
            if (simulator) {
                const qubit = parseInt(qubitSelect.value);
                injectError(qubit);
            } else {
                console.warn('[WARN] Error button clicked but no simulator:', {
                    errorType: err.type,
                    hasSimulator: !!simulator
                });
            }
        });
        errorButtons.appendChild(btn);
    });
    
    setSelectedError(null);
    
    window.updateErrorControls = updateQubitOptions;
}

