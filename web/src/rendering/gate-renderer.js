// Individual gate rendering with Konva
import Konva from 'konva';
import { selectedGate, currentTime } from '../state.js';
import { handleCircuitClick, handleCircuitRightClick } from '../events/circuit-handlers.js';

export function renderGate(layer, gate, time, spacing, qubitSpacing, startX, clickAreaMap) {
    const x = startX + time * spacing;
    
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
    const createCenteredText = (centerX, centerY, textContent, qubit) => {
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
            fill: '#333',
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
        
        // Gate box - centered at (x, y)
        const box = new Konva.Rect({
            x: x - 15,
            y: y - 15,
            width: 30,
            height: 30,
            fill: 'white',
            stroke: time < currentTime ? '#463a47' : '#6A9DCE',
            strokeWidth: time < currentTime ? 2.5 : 2,
            cornerRadius: 4,
            opacity: time < currentTime ? 0.9 : 1,
        });
        addGateInteractivity(box, qubit);
        layer.add(box);
        box.zIndex(10);
        box.moveToTop();
        // Cache the box for better performance (caches rendered bitmap)
        box.cache();
        
        // Gate symbol text - center at (x, y)
        const textContent = gateType === 'Sdg' ? 'S†' : gateType;
        const textNode = createCenteredText(x, y, textContent, qubit);
        // Cache text rendering (most expensive operation)
        if (textNode) {
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
            
            // CNOT line
            const line = new Konva.Line({
                points: [x, yControl, x, yTarget],
                stroke: '#333',
                strokeWidth: 2,
            });
            addGateInteractivity(line, control);
            layer.add(line);
            line.zIndex(10);
            line.moveToTop();
            // Cache the line for better performance
            line.cache();
            
            // Control dot
            const controlDot = new Konva.Circle({
                x: x,
                y: yControl,
                radius: 5,
                fill: '#7AB9E5',
            });
            addGateInteractivity(controlDot, control);
            layer.add(controlDot);
            controlDot.zIndex(11);
            controlDot.moveToTop();
            // Cache the control dot
            controlDot.cache();
            
            // Target box
            const targetBox = new Konva.Rect({
                x: x - 15,
                y: yTarget - 15,
                width: 30,
                height: 30,
                fill: 'white',
                stroke: time < currentTime ? '#463a47' : '#6A9DCE',
                strokeWidth: time < currentTime ? 2.5 : 2,
                cornerRadius: 4,
                opacity: time < currentTime ? 0.9 : 1,
            });
            addGateInteractivity(targetBox, target);
            layer.add(targetBox);
            targetBox.zIndex(10);
            targetBox.moveToTop();
            // Cache the target box
            targetBox.cache();
            
            // Target symbol - center at (x, yTarget)
            const targetText = createCenteredText(x, yTarget, '⊕', target);
            // Cache text rendering
            if (targetText) {
                targetText.cache();
            }
            
        } else if (twoGate.CZ) {
            const cz = twoGate.CZ;
            const control = cz.control;
            const target = cz.target;
            const yControl = 40 + control * qubitSpacing;
            const yTarget = 40 + target * qubitSpacing;
            
            // CZ line
            const line = new Konva.Line({
                points: [x, yControl, x, yTarget],
                stroke: '#333',
                strokeWidth: 2,
            });
            addGateInteractivity(line, control);
            layer.add(line);
            line.zIndex(10);
            line.moveToTop();
            // Cache the line for better performance
            line.cache();
            
            // Control and target dots
            [yControl, yTarget].forEach((y, idx) => {
                const qubit = idx === 0 ? control : target;
                const dot = new Konva.Circle({
                    x: x,
                    y: y,
                    radius: 5,
                    fill: '#7AB9E5',
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
            
            // SWAP line
            const line = new Konva.Line({
                points: [x, y1, x, y2],
                stroke: '#333',
                strokeWidth: 2,
            });
            addGateInteractivity(line, q1);
            layer.add(line);
            line.zIndex(3);
            // Cache the line for better performance
            line.cache();
            
            // SWAP symbols - center at (x, y1) and (x, y2)
            const swapText1 = createCenteredText(x, y1, '×', q1);
            const swapText2 = createCenteredText(x, y2, '×', q2);
            // Cache text rendering
            if (swapText1) {
                swapText1.cache();
            }
            if (swapText2) {
                swapText2.cache();
            }
        }
    }
}
