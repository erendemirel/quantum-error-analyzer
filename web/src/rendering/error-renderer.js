// Error visualization rendering with Konva
import Konva from 'konva';

const errorColors = {
    'x': '#e65a6e',
    'y': '#6bc4a8',
    'z': '#e6c85a',
    'i': '#bdc3c7'
};

export function renderError(layer, error, qubit, time, spacing, qubitSpacing, startX) {
    const x = 60;
    const y = 40 + qubit * qubitSpacing;
    const color = errorColors[error.toLowerCase()] || '#333';
    
    const text = new Konva.Text({
        x: x,
        y: y,
        text: error,
        fontSize: 18,
        fontFamily: 'Courier New',
        fontStyle: '700',
        fill: color,
        align: 'center',
        verticalAlign: 'middle',
        listening: false,
    });
    
    layer.add(text);
    text.zIndex(5); // Set zIndex after adding to layer
}
