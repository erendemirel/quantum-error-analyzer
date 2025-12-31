// Individual gate rendering with Konva
import Konva from 'konva';
import { selectedGate, currentTime } from '../state.js';
import { handleCircuitClick, handleCircuitRightClick } from '../events/circuit-handlers.js';

export function renderGate(layer, gate, time, spacing, qubitSpacing, startX, clickAreaMap, gatesAtTime = []) {
    const x = startX + time * spacing;
    
    // Helper to get qubits from a gate
    const getGateQubits = (g) => {
        if (g.Single) return [g.Single.qubit];
        if (g.Two) {
            if (g.Two.CNOT) return [g.Two.CNOT.control, g.Two.CNOT.target];
            if (g.Two.CZ) return [g.Two.CZ.control, g.Two.CZ.target];
            if (g.Two.SWAP) return [g.Two.SWAP.qubit1, g.Two.SWAP.qubit2];
        }
        return [];
    };
    
    // Check if there are single-qubit gates that overlap with two-qubit gates at this time
    const singleQubitGatesAtTime = gatesAtTime.filter(({gate: g}) => g.Single);
    const allTwoQubitGatesAtTime = gatesAtTime.filter(({gate: g}) => g.Two);
    
    // Count two-qubit gates at this time step (excluding current gate)
    const twoQubitGateIndex = gatesAtTime.findIndex(({gate: g}) => g === gate && g.Two);
    // Assign a color index based on position among two-qubit gates
    const colorIndex = twoQubitGateIndex >= 0 ? 
        gatesAtTime.slice(0, twoQubitGateIndex).filter(({gate: g}) => g.Two).length : 0;
    
    // Color palette for two-qubit gate ends (control/target dots)
    const twoQubitColors = [
        '#7AB9E5', // Blue (default)
        '#E74C3C', // Red
        '#2ECC71', // Green
        '#F39C12', // Orange
        '#9B59B6', // Purple
        '#1ABC9C', // Teal
    ];
    const gateColor = twoQubitColors[colorIndex % twoQubitColors.length];
    
    // Helper function to add interactivity to gate elements
    const addGateInteractivity = (element, qubit) => {
        element.setAttr('data-qubit', qubit);
        element.setAttr('data-time', time);
        element.listening(true);
        
        // Handle cursor via mouse events
        element.on('mouseenter', () => {
            const stage = element.getStage();
            if (stage) {
                stage.container().style.cursor = 'pointer';
            }
        });
        element.on('mouseleave', () => {
            const stage = element.getStage();
            if (stage) {
                stage.container().style.cursor = 'default';
            }
        });
        
        // Store reference to click area for this qubit/time
        const clickAreaKey = `${qubit}-${time}`;
        const clickAreaRef = clickAreaMap.get(clickAreaKey);
        
        element.on('click', (e) => {
            // Only handle left click (button 0), ignore right click
            if (e.evt.button === 0 || e.evt.button === undefined) {
                handleCircuitClick({ qubit, time });
            }
        });
        
        element.on('contextmenu', (e) => {
            e.evt.preventDefault();
            e.evt.stopPropagation(); // Prevent event from bubbling to container
            handleCircuitRightClick(e); // Pass the Konva event so it can extract qubit/time
        });
        
        element.on('mouseenter', () => {
            element.opacity(0.8);
            layer.draw();
            
            // Find and highlight the corresponding click area
            if (clickAreaRef) {
                clickAreaRef.setAttr('_isGateHovered', true);
                if (selectedGate) {
                    clickAreaRef.fill('rgba(52, 152, 219, 0.15)');
                    clickAreaRef.stroke('rgba(52, 152, 219, 0.5)');
                    clickAreaRef.strokeWidth(2);
                    clickAreaRef.dash([4, 4]);
                    layer.draw();
                }
            }
        });
        
        element.on('mouseleave', () => {
            element.opacity(1);
            layer.draw();
            
            // Clear gate hover flag and remove highlight if mouse truly left
            if (clickAreaRef) {
                clickAreaRef.setAttr('_isGateHovered', false);
                // Small delay to check if mouse moved to click area
                setTimeout(() => {
                    if (clickAreaRef && !clickAreaRef.getAttr('_isGateHovered')) {
                        clickAreaRef.fill('transparent');
                        clickAreaRef.stroke(null);
                        clickAreaRef.strokeWidth(0);
                        clickAreaRef.dash([]);
                        layer.draw();
                    }
                }, 50);
            }
        });
    };
    
    // Helper to create centered text in a box
    const createCenteredText = (centerX, centerY, textContent, qubit, fillColor = '#333') => {
        // Character-specific adjustments - H, X, Y, Z look good with base offsets
        // Others need different adjustments
        let offsetY = -10; // Base: shift up by 10px
        let offsetX = -5;  // Base: shift left by 5px
        
        // Character-specific fine-tuning
        if (textContent === 'S') {
            // S needs to go down and right (less upward shift, less leftward shift)
            offsetY = -10;
            offsetX = -5;
        } else if (textContent === 'S†') {
            // S dagger needs to go down more (less upward shift)
            offsetY = -10;
            offsetX = -8;
        } else if (textContent === '⊕') {
            // CNOT symbol needs to go left (very little) - more leftward shift
            offsetY = -9;
            offsetX = -9.5;
        } else if (textContent === '×') {
            // SWAP symbol needs to go left - more leftward shift
            offsetY = -8;
            offsetX = -5.5;
        }
        // H, X, Y, Z use base offsets (already good: -10px up, -5px left)
        
        const textY = centerY + offsetY;
        const textX = centerX + offsetX;
        
        const text = new Konva.Text({
            x: textX,
            y: textY,
            text: textContent,
            fontSize: 18,
            fontFamily: 'Courier New',
            fontStyle: '600',
            fill: fillColor,
            align: 'center',
        });
        
            addGateInteractivity(text, qubit);
            layer.add(text);
            text.zIndex(11);
            text.moveToTop();

            return text;
    };
    
    if (gate.Single) {
        const single = gate.Single;
        const qubit = single.qubit;
        const gateType = single.gate;
        const y = 40 + qubit * qubitSpacing;
        
        // Check if this single-qubit gate overlaps with any two-qubit gate at this time
        const overlappingTwoQubitGate = allTwoQubitGatesAtTime.find(({gate: g}) => {
            const qubits = getGateQubits(g);
            return qubits.includes(qubit);
        });
        
        // If overlapping, put single-qubit gate on top and we'll need to break the line
        const zIndex = overlappingTwoQubitGate ? 15 : 10;
        
        // Determine if gate has been executed and adjust colors/opacity accordingly
        const isExecuted = time < currentTime;
        // Helper to darken a color (reduce brightness while preserving hue)
        const darkenColor = (color) => {
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                const darkR = Math.floor(r * 0.6);
                const darkG = Math.floor(g * 0.6);
                const darkB = Math.floor(b * 0.6);
                return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
            }
            return color;
        };
        // Use same blue as CNOT gates, darkened when executed
        const singleGateColor = '#6A9DCE';
        const boxStroke = isExecuted ? darkenColor(singleGateColor) : singleGateColor;
        const gateOpacity = isExecuted ? 0.9 : 1;
        const strokeWidth = isExecuted ? 2.5 : 2;
        
        // Gate box - centered at (x, y)
        const box = new Konva.Rect({
            x: x - 15,
            y: y - 15,
            width: 30,
            height: 30,
            fill: 'white',
            stroke: boxStroke,
            strokeWidth: strokeWidth,
            cornerRadius: 4,
            opacity: gateOpacity,
        });
        addGateInteractivity(box, qubit);
        layer.add(box);
        box.zIndex(zIndex);
        // Always move to top - since we render two-qubit gates first, overlapping gates will be on top
        box.moveToTop();
        // Cache the box for better performance (caches rendered bitmap)
        box.cache();
        
        // Gate symbol text - center at (x, y), adjust opacity if executed
        const textContent = gateType === 'Sdg' ? 'S†' : gateType;
        const textNode = createCenteredText(x, y, textContent, qubit);
        if (textNode) {
            textNode.zIndex(zIndex + 1);
            textNode.opacity(gateOpacity);
            // Always move to top - since we render two-qubit gates first, overlapping gates will be on top
            textNode.moveToTop();
            // Cache text rendering (most expensive operation)
            textNode.cache();
        }
        
    } else if (gate.Two) {
        const twoGate = gate.Two;
        if (twoGate.CNOT) {
            const cnot = twoGate.CNOT;
            const control = cnot.control;
            const target = cnot.target;
            const yControl = 40 + control * qubitSpacing;
            const yTarget = 40 + target * qubitSpacing;
            
            // Check if there are single-qubit gates overlapping with this two-qubit gate
            const overlappingSingleGates = singleQubitGatesAtTime.filter(({gate: g}) => {
                const qubit = g.Single.qubit;
                return qubit === control || qubit === target;
            });
            
            // Build line points, breaking at overlapping single-qubit gates
            let linePoints;
            if (overlappingSingleGates.length === 0) {
                // No overlaps - simple line from control to target
                linePoints = [x, yControl, x, yTarget];
            } else {
                // Has overlaps - break line at overlapping gates
                linePoints = [x, yControl];
                const gateBoxYStart = (y) => y - 15;
                const gateBoxYEnd = (y) => y + 15;
                
                // Sort overlapping gates by their y position
                const overlappingYs = overlappingSingleGates.map(({gate: g}) => {
                    const q = g.Single.qubit;
                    return 40 + q * qubitSpacing;
                }).sort((a, b) => a - b);
                
                // Add line segments, skipping areas where single-qubit gates overlap
                let currentY = yControl;
                for (const overlapY of overlappingYs) {
                    const overlapStart = gateBoxYStart(overlapY);
                    const overlapEnd = gateBoxYEnd(overlapY);
                    
                    // If we haven't reached the overlap yet, draw line up to just before it
                    if (currentY < overlapStart) {
                        linePoints.push(x, overlapStart);
                    }
                    // Skip the overlap area - update currentY to just after the overlap
                    currentY = Math.max(currentY, overlapEnd);
                    // Add a point just after the overlap to continue the line
                    if (currentY < yTarget) {
                        linePoints.push(x, currentY);
                    }
                }
                
                // Draw final segment to target if we haven't reached it
                if (currentY < yTarget) {
                    linePoints.push(x, yTarget);
                }
            }
            
            // Determine if gate has been executed and adjust colors/opacity accordingly
            const isExecuted = time < currentTime;
            // Helper to darken a color (reduce brightness while preserving hue)
            const darkenColor = (color) => {
                // For hex colors, reduce brightness by ~40%
                if (color.startsWith('#')) {
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    const darkR = Math.floor(r * 0.6);
                    const darkG = Math.floor(g * 0.6);
                    const darkB = Math.floor(b * 0.6);
                    return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
                }
                return color;
            };
            // Preserve colors but darken them when executed
            const futureColor = allTwoQubitGatesAtTime.length > 1 ? gateColor : '#6A9DCE';
            const lineColor = isExecuted ? darkenColor('#333') : '#333';
            const controlDotColor = isExecuted ? darkenColor(gateColor) : gateColor;
            const targetBoxStroke = isExecuted ? darkenColor(futureColor) : futureColor;
            const gateOpacity = isExecuted ? 0.9 : 1;
            const strokeWidth = isExecuted ? 2.5 : 2;
            
            // Only draw line if we have at least start and end points
            if (linePoints.length >= 4) {
                const line = new Konva.Line({
                    points: linePoints,
                    stroke: lineColor,
                    strokeWidth: strokeWidth,
                    opacity: gateOpacity,
                });
                addGateInteractivity(line, control);
                layer.add(line);
                line.zIndex(10);
                line.moveToTop();
                // Cache the line for better performance
                line.cache();
            }
            
            // Control dot - use color based on position among two-qubit gates, darker if executed
            const controlDot = new Konva.Circle({
                x: x,
                y: yControl,
                radius: 5,
                fill: controlDotColor,
                opacity: gateOpacity,
            });
            addGateInteractivity(controlDot, control);
            layer.add(controlDot);
            controlDot.zIndex(11);
            controlDot.moveToTop();
            // Cache the control dot
            controlDot.cache();
            
            // Target box - use gateColor for stroke when multiple gates overlap, darker if executed
            const targetBox = new Konva.Rect({
                x: x - 15,
                y: yTarget - 15,
                width: 30,
                height: 30,
                fill: 'white',
                stroke: targetBoxStroke,
                strokeWidth: strokeWidth,
                cornerRadius: 4,
                opacity: gateOpacity,
            });
            addGateInteractivity(targetBox, target);
            layer.add(targetBox);
            targetBox.zIndex(10);
            targetBox.moveToTop();
            // Cache the target box
            targetBox.cache();
            
            // Target symbol - center at (x, yTarget), adjust opacity if executed
            const targetText = createCenteredText(x, yTarget, '⊕', target);
            // Cache text rendering
            if (targetText) {
                targetText.opacity(gateOpacity);
                targetText.cache();
            }
            
        } else if (twoGate.CZ) {
            const cz = twoGate.CZ;
            const control = cz.control;
            const target = cz.target;
            const yControl = 40 + control * qubitSpacing;
            const yTarget = 40 + target * qubitSpacing;
            
            // Check if there are single-qubit gates overlapping with this two-qubit gate
            const overlappingSingleGates = singleQubitGatesAtTime.filter(({gate: g}) => {
                const qubit = g.Single.qubit;
                return qubit === control || qubit === target;
            });
            
            // Build line points, breaking at overlapping single-qubit gates
            const linePoints = [x, yControl];
            const gateBoxHeight = 30;
            const gateBoxYStart = (y) => y - 15;
            const gateBoxYEnd = (y) => y + 15;
            
            // Sort overlapping gates by their y position
            const overlappingYs = overlappingSingleGates.map(({gate: g}) => {
                const q = g.Single.qubit;
                return 40 + q * qubitSpacing;
            }).sort((a, b) => a - b);
            
            // Add line segments, skipping areas where single-qubit gates overlap
            let currentY = yControl;
            for (const overlapY of overlappingYs) {
                const overlapStart = gateBoxYStart(overlapY);
                const overlapEnd = gateBoxYEnd(overlapY);
                
                // If we haven't reached the overlap yet, draw line up to just before it
                if (currentY < overlapStart) {
                    linePoints.push(x, overlapStart);
                }
                // Skip the overlap area - update currentY to just after the overlap
                currentY = Math.max(currentY, overlapEnd);
                // Add a point just after the overlap to continue the line
                if (currentY < yTarget) {
                    linePoints.push(x, currentY);
                }
            }
            
            // Draw final segment to target if we haven't reached it
            if (currentY < yTarget) {
                linePoints.push(x, yTarget);
            }
            
            // Determine if gate has been executed and adjust colors/opacity accordingly
            const isExecuted = time < currentTime;
            // Helper to darken a color (reduce brightness while preserving hue)
            const darkenColor = (color) => {
                if (color.startsWith('#')) {
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    const darkR = Math.floor(r * 0.6);
                    const darkG = Math.floor(g * 0.6);
                    const darkB = Math.floor(b * 0.6);
                    return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
                }
                return color;
            };
            // Preserve colors but darken them when executed
            const dotColor = isExecuted ? darkenColor(gateColor) : gateColor;
            const gateOpacity = isExecuted ? 0.9 : 1;
            const strokeWidth = isExecuted ? 2.5 : 2;
            
            // Only draw line if we have at least start and end points
            if (linePoints.length >= 4) {
                const line = new Konva.Line({
                    points: linePoints,
                    stroke: isExecuted ? darkenColor('#333') : '#333',
                    strokeWidth: strokeWidth,
                    opacity: gateOpacity,
                });
                addGateInteractivity(line, control);
                layer.add(line);
                line.zIndex(10);
                line.moveToTop();
                // Cache the line for better performance
                line.cache();
            }
            
            // Control and target dots - use color based on position among two-qubit gates, darker if executed
            [yControl, yTarget].forEach((y, idx) => {
                const qubit = idx === 0 ? control : target;
                const dot = new Konva.Circle({
                    x: x,
                    y: y,
                    radius: 5,
                    fill: dotColor,
                    opacity: gateOpacity,
                });
                addGateInteractivity(dot, qubit);
                layer.add(dot);
                dot.zIndex(11);
                dot.moveToTop();
                // Cache each dot
                dot.cache();
            });
        } else if (twoGate.SWAP) {
            const swap = twoGate.SWAP;
            const q1 = swap.qubit1;
            const q2 = swap.qubit2;
            const y1 = 40 + q1 * qubitSpacing;
            const y2 = 40 + q2 * qubitSpacing;
            
            // Check if there are single-qubit gates overlapping with this two-qubit gate
            const overlappingSingleGates = singleQubitGatesAtTime.filter(({gate: g}) => {
                const qubit = g.Single.qubit;
                return qubit === q1 || qubit === q2;
            });
            
            // Build line points, breaking at overlapping single-qubit gates
            const linePoints = [x, y1];
            const gateBoxYStart = (y) => y - 15;
            const gateBoxYEnd = (y) => y + 15;
            
            // Sort overlapping gates by their y position
            const overlappingYs = overlappingSingleGates.map(({gate: g}) => {
                const q = g.Single.qubit;
                return 40 + q * qubitSpacing;
            }).sort((a, b) => a - b);
            
            // Add line segments, skipping areas where single-qubit gates overlap
            let currentY = y1;
            for (const overlapY of overlappingYs) {
                const overlapStart = gateBoxYStart(overlapY);
                const overlapEnd = gateBoxYEnd(overlapY);
                
                // If we haven't reached the overlap yet, draw line up to just before it
                if (currentY < overlapStart) {
                    linePoints.push(x, overlapStart);
                }
                // Skip the overlap area - update currentY to just after the overlap
                currentY = Math.max(currentY, overlapEnd);
                // Add a point just after the overlap to continue the line
                if (currentY < y2) {
                    linePoints.push(x, currentY);
                }
            }
            
            // Draw final segment to target if we haven't reached it
            if (currentY < y2) {
                linePoints.push(x, y2);
            }
            
            // Determine if gate has been executed and adjust colors/opacity accordingly
            const isExecuted = time < currentTime;
            // Helper to darken a color (reduce brightness while preserving hue)
            const darkenColor = (color) => {
                if (color.startsWith('#')) {
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    const darkR = Math.floor(r * 0.6);
                    const darkG = Math.floor(g * 0.6);
                    const darkB = Math.floor(b * 0.6);
                    return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
                }
                return color;
            };
            // Preserve colors but darken them when executed
            const swapColor = isExecuted ? darkenColor(gateColor) : gateColor;
            const gateOpacity = isExecuted ? 0.9 : 1;
            const strokeWidth = isExecuted ? 2.5 : 2;
            
            // Only draw line if we have at least start and end points
            if (linePoints.length >= 4) {
                const line = new Konva.Line({
                    points: linePoints,
                    stroke: isExecuted ? darkenColor('#333') : '#333',
                    strokeWidth: strokeWidth,
                    opacity: gateOpacity,
                });
                addGateInteractivity(line, q1);
                layer.add(line);
                line.zIndex(3);
                // Cache the line for better performance
                line.cache();
            }
            
            // SWAP symbols - center at (x, y1) and (x, y2)
            // Use higher z-index if overlapping with single-qubit gates
            // Use color based on position among two-qubit gates, darker if executed
            const zIndex = overlappingSingleGates.length > 0 ? 15 : 11;
            const swapText1 = createCenteredText(x, y1, '×', q1, swapColor);
            const swapText2 = createCenteredText(x, y2, '×', q2, swapColor);
            if (swapText1) {
                swapText1.zIndex(zIndex);
                swapText1.opacity(gateOpacity);
                swapText1.moveToTop();
                swapText1.cache();
            }
            if (swapText2) {
                swapText2.zIndex(zIndex);
                swapText2.opacity(gateOpacity);
                swapText2.moveToTop();
                swapText2.cache();
            }
        }
    }
}
