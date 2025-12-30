// Gate palette UI
import { selectedGate, setSelectedGate } from '../state.js';
import { renderCircuit } from '../rendering/circuit-renderer.js';

export function setupGatePalette() {
    const palette = document.getElementById('gate-palette');
    palette.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h3 style="margin: 0;">Gates</h3>
            <span class="info-tooltip" style="position: relative; cursor: help;">
                <span style="font-size: 0.9rem; color: #666; border: 1px solid #ccc; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; background: #f0f0f0;">?</span>
                <span class="tooltip-text" style="visibility: hidden; width: 200px; background-color: #f5f5f5; color: #333; text-align: left; border-radius: 6px; padding: 8px; position: absolute; z-index: 1000; bottom: 125%; left: 50%; margin-left: -100px; font-size: 0.75rem; line-height: 1.4; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #ddd;">
                    <strong>Gate Operations:</strong><br>
                    • Click to place/replace gates<br>
                    • Right-click to remove gates
                    <span style="position: absolute; top: 100%; left: 50%; margin-left: -5px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #f5f5f5;"></span>
                </span>
            </span>
        </div>
        <div class="gate-buttons"></div>
    `;
    const buttons = palette.querySelector('.gate-buttons');
    
    // Add tooltip hover functionality
    const tooltip = palette.querySelector('.info-tooltip');
    const tooltipText = palette.querySelector('.tooltip-text');
    tooltip.addEventListener('mouseenter', () => {
        tooltipText.style.visibility = 'visible';
    });
    tooltip.addEventListener('mouseleave', () => {
        tooltipText.style.visibility = 'hidden';
    });
    
    const gates = [
        { name: 'H', label: 'H' },
        { name: 'S', label: 'S' },
        { name: 'Sdg', label: 'S†' },
        { name: 'X', label: 'X' },
        { name: 'Y', label: 'Y' },
        { name: 'Z', label: 'Z' },
        { name: 'CNOT', label: 'CNOT' },
        { name: 'CZ', label: 'CZ' },
        { name: 'SWAP', label: 'SWAP' },
    ];
    
    gates.forEach(gate => {
        const btn = document.createElement('button');
        btn.className = 'gate-btn';
        btn.textContent = gate.label;
        btn.dataset.gate = gate.name;
        btn.addEventListener('click', () => {
            // If clicking the same gate that's already selected, keep it selected
            // (don't toggle off - this allows placing multiple gates of the same type)
            if (selectedGate === gate.name) {
                // Keep it selected - don't toggle off
                return;
            }
            // If clicking a different gate, deselect previous and select new one
            document.querySelectorAll('.gate-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setSelectedGate(gate.name);
            renderCircuit();
        });
        buttons.appendChild(btn);
    });
}

