import { circuit, setCircuit, simulator, setSimulator, setCurrentTime, initialError, setInitialError } from '../state.js';
import { WasmCircuit, WasmSimulator } from '../wasm-loader.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';
import { updateDisplay } from '../main.js';
import { showNotification } from '../utils/notifications.js';

export function setupImportExport() {
    const appElement = document.getElementById('app');
    
    // Create button group positioned in space between header and main layout
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'circuit-actions';
    buttonGroup.id = 'circuit-actions';
    buttonGroup.innerHTML = `
        <input type="file" id="import-file-input" accept=".json,.qasm,.txt" style="display: none;">
        <button id="import-btn" class="circuit-action-btn import-btn">Import</button>
        <div class="save-button-group">
            <button id="save-btn" class="circuit-action-btn save-btn">Save</button>
            <div class="save-dropdown" id="save-dropdown">
                <button class="save-option" data-format="json">Save as JSON</button>
                <button class="save-option" data-format="qasm">Save as QASM</button>
                <button class="save-option" data-format="latex">Save as LaTeX</button>
            </div>
        </div>
    `;
    
    // Insert button group after header, before main
    const mainElement = document.querySelector('main');
    appElement.insertBefore(buttonGroup, mainElement);
    
    // Import functionality
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');
    
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });
    
    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target.result;
                let newCircuit;
                
                // Auto-detect format
                if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                    // JSON format
                    newCircuit = WasmCircuit.import_json(content);
                } else if (content.includes('OPENQASM') || content.includes('qreg')) {
                    // QASM format
                    newCircuit = WasmCircuit.import_qasm(content);
                } else {
                    throw new Error('Could not auto-detect file format. Expected JSON or QASM.');
                }
                
                if (!newCircuit) {
                    throw new Error('Failed to import circuit');
                }
                
                // Create new simulator with imported circuit
                const newSimulator = new WasmSimulator(newCircuit);
                setCircuit(newCircuit);
                setSimulator(newSimulator);
                setCurrentTime(0);
                
                // Clear initial error when importing
                setInitialError(null);
                
                // Update UI
                const qubitCountInput = document.getElementById('qubit-count-input');
                if (qubitCountInput) {
                    qubitCountInput.value = newCircuit.num_qubits();
                }
                
                renderCircuit();
                updateDisplay();
                
                if (window.updateSimulationControls) {
                    window.updateSimulationControls();
                }
                
                showNotification('Circuit imported successfully!', 3000, 'success');
            } catch (error) {
                console.error('Import error:', error);
                showNotification(`Import failed: ${error.message}`, 5000);
            }
        };
        
        reader.readAsText(file);
        // Reset file input
        e.target.value = '';
    });
    
    // Save dropdown functionality
    const saveBtn = document.getElementById('save-btn');
    const saveDropdown = document.getElementById('save-dropdown');
    const saveOptions = document.querySelectorAll('.save-option');
    
    // Toggle dropdown when clicking save button
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!buttonGroup.contains(e.target)) {
            saveDropdown.classList.remove('active');
        }
    });
    
    // Handle save options
    saveOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const format = option.getAttribute('data-format');
            handleSave(format);
            saveDropdown.classList.remove('active');
        });
    });
}

function handleSave(format) {
    if (!circuit) {
        showNotification('No circuit to save', 3000, 'error');
        return;
    }
    
    try {
        let content, filename, mimeType;
        
        switch (format) {
            case 'json':
                content = circuit.export_json();
                filename = 'circuit.json';
                mimeType = 'application/json';
                break;
            case 'qasm':
                content = circuit.export_qasm();
                filename = 'circuit.qasm';
                mimeType = 'text/plain';
                break;
            case 'latex':
                content = circuit.export_latex();
                filename = 'circuit.tex';
                mimeType = 'text/plain';
                break;
            default:
                throw new Error('Unknown save format');
        }
        
        // Perform the export and download
        downloadFile(content, filename, mimeType);
        // No notification - the download itself provides feedback
    } catch (error) {
        console.error('Save error:', error);
        showNotification(`Save failed: ${error.message}`, 5000);
    }
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

