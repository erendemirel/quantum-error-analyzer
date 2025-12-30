// Error evolution chart rendering
import { circuit, currentTime, errorHistory } from '../state.js';
import { getCircuitDepth } from '../components/time-scheduler.js';

export function renderErrorChart() {
    const chartContainer = document.getElementById('error-chart');
    if (!chartContainer || !circuit || errorHistory.length === 0) {
        if (chartContainer) {
            chartContainer.innerHTML = '<h3>Error Evolution</h3><div style="padding: 20px; color: #999; text-align: center; font-size: 0.85rem;">Step through the circuit to see error evolution</div>';
        }
        return;
    }
    
    const numQubits = circuit.num_qubits();
    const maxTime = getCircuitDepth();
    const width = 250;
    const height = 200;
    const legendHeight = 25;
    const timeLabelHeight = 20; // Space for time step labels below chart
    const padding = { top: 20, right: 10, bottom: legendHeight + timeLabelHeight + 10, left: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom - legendHeight - timeLabelHeight;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'error-chart-svg');
    
    const pauliToY = (pauli, qubit) => {
        const qubitHeight = chartHeight / numQubits;
        const baseY = padding.top + qubit * qubitHeight + qubitHeight / 2;
        const offset = { 'I': 0, 'X': -qubitHeight * 0.25, 'Y': 0, 'Z': qubitHeight * 0.25 };
        return baseY + (offset[pauli] || 0);
    };
    
    const pauliToColor = (pauli) => {
        const colors = { 'X': '#e65a6e', 'Y': '#6bc4a8', 'Z': '#e6c85a', 'I': '#bdc3c7' };
        return colors[pauli] || '#000';
    };
    
    for (let q = 0; q < numQubits; q++) {
        const y = padding.top + q * (chartHeight / numQubits) + (chartHeight / numQubits) / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', padding.left);
        line.setAttribute('y1', y);
        line.setAttribute('x2', padding.left + chartWidth);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#e0e0e0');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        svg.appendChild(line);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', 5);
        label.setAttribute('y', y + 4);
        label.setAttribute('font-size', '10');
        label.setAttribute('fill', '#666');
        label.textContent = `Q${q}`;
        svg.appendChild(label);
    }
    
    for (let t = 0; t <= maxTime; t++) {
        const x = padding.left + (maxTime > 0 ? (t / maxTime) * chartWidth : 0);
        const data = errorHistory[t];
        
        if (data) {
            const hasNegativePhase = data.phase === '-';
            for (let q = 0; q < numQubits; q++) {
                const pauli = data.pattern[q] || 'I';
                const y = pauliToY(pauli, q);
                const color = pauliToColor(pauli);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', t === currentTime ? '6' : '4');
                
                if (hasNegativePhase && pauli !== 'I') {
                    circle.setAttribute('fill', 'transparent');
                    circle.setAttribute('stroke', color);
                    circle.setAttribute('stroke-width', '2');
                } else {
                    circle.setAttribute('fill', color);
                }
                
                if (t === currentTime) {
                    circle.setAttribute('stroke', '#333');
                    circle.setAttribute('stroke-width', hasNegativePhase ? '3' : '2');
                }
                svg.appendChild(circle);
                
                if (hasNegativePhase && pauli !== 'I') {
                    const minus = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    minus.setAttribute('x', x);
                    minus.setAttribute('y', y + 3);
                    minus.setAttribute('font-size', '8');
                    minus.setAttribute('fill', color);
                    minus.setAttribute('text-anchor', 'middle');
                    minus.setAttribute('font-weight', 'bold');
                    minus.textContent = '-';
                    svg.appendChild(minus);
                }
            }
        }
    }
    
    for (let t = 0; t <= maxTime; t++) {
        if (t % Math.max(1, Math.floor(maxTime / 5)) === 0 || t === maxTime) {
            const x = padding.left + (maxTime > 0 ? (t / maxTime) * chartWidth : 0);
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x);
            tick.setAttribute('y1', padding.top + chartHeight);
            tick.setAttribute('x2', x);
            tick.setAttribute('y2', padding.top + chartHeight + 5);
            tick.setAttribute('stroke', '#999');
            tick.setAttribute('stroke-width', '1');
            svg.appendChild(tick);
            
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', padding.top + chartHeight + 20);
            label.setAttribute('font-size', '9');
            label.setAttribute('fill', '#666');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = t;
            svg.appendChild(label);
        }
    }
    
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const legendY = height - 20;
    const legendItems = [
        { label: 'X', color: '#e65a6e', x: 5 },
        { label: 'Y', color: '#6bc4a8', x: 35 },
        { label: 'Z', color: '#e6c85a', x: 65 },
        { label: 'I', color: '#bdc3c7', x: 95 },
    ];
    
    legendItems.forEach(item => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', item.x);
        circle.setAttribute('cy', legendY);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', item.color);
        legend.appendChild(circle);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', item.x + 8);
        text.setAttribute('y', legendY + 4);
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#666');
        text.textContent = item.label;
        legend.appendChild(text);
    });
    
    const phaseExample = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    phaseExample.setAttribute('cx', 130);
    phaseExample.setAttribute('cy', legendY);
    phaseExample.setAttribute('r', '4');
    phaseExample.setAttribute('fill', 'transparent');
    phaseExample.setAttribute('stroke', '#e65a6e');
    phaseExample.setAttribute('stroke-width', '2');
    legend.appendChild(phaseExample);
    
    const phaseLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    phaseLabel.setAttribute('x', 140);
    phaseLabel.setAttribute('y', legendY + 4);
    phaseLabel.setAttribute('font-size', '8');
    phaseLabel.setAttribute('fill', '#999');
    phaseLabel.textContent = '= -phase';
    legend.appendChild(phaseLabel);
    
    svg.appendChild(legend);
    
    chartContainer.innerHTML = '<h3>Error Evolution</h3>';
    chartContainer.appendChild(svg);
}

