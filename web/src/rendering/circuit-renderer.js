// Main circuit Konva rendering
import Konva from 'konva';
import { circuit, simulator, selectedGate, currentTime, initialError, gateTimePositions, previousCircuitDepth, setPreviousCircuitDepth, lastPlacedGateTime, setLastPlacedGateTime, pendingTwoQubitGate } from '../state.js';
import { getCircuitDepth } from '../components/time-scheduler.js';
import { renderGate } from './gate-renderer.js';
import { renderError } from './error-renderer.js';
import { handleCircuitClick, handleCircuitRightClick } from '../events/circuit-handlers.js';

// Store Konva stage and layer references
let konvaStage = null;
let konvaLayer = null; // Dynamic layer: gates, click areas, errors
let staticLayer = null; // Static layer: qubit lines, labels, grid, highlights, separators
let clickAreaMap = new Map(); // Map to store click areas for hover coordination
let scrollListenerAttached = false;
let scrollTimeout = null;
let isAutoScrolling = false; // Flag to prevent scroll listener from firing during programmatic scroll
let staticLayerDirty = false; // Flag to track if static layer needs redraw

export function updateTimeSeparators() {
    if (!circuit || !staticLayer) return;
    
    // Remove existing separator lines from static layer
    const separators = staticLayer.find('.time-separator-line');
    separators.forEach(sep => sep.destroy());
    
    // Use the same constants as renderCircuit
    const depth = Math.max(getCircuitDepth(), 5);
    const numQubits = circuit.num_qubits();
    const spacing = 100;
    const startX = 100;
    const qubitSpacing = 80;
    
    // Match highlighting boundaries: from top (y=0) to bottom of last qubit
    const topY = 0;
    const bottomY = 40 + numQubits * qubitSpacing;
    
    // Create separator lines
    for (let t = 0; t < depth; t++) {
        const x = startX + (t + 0.5) * spacing;
        
        const separator = new Konva.Line({
            name: 'time-separator-line',
            points: [x, topY, x, bottomY],
            stroke: t < currentTime ? '#625264' : '#bbb',
            strokeWidth: 1,
            dash: t < currentTime ? [] : [3, 3],
            opacity: t < currentTime ? 1 : 0.7,
            listening: false, // Don't capture pointer events
        });
        
        staticLayer.add(separator);
        separator.moveToBottom(); // Behind gates
    }
    
    staticLayer.batchDraw();
}

export function renderCircuit() {
    const view = document.getElementById('circuit-view');
    if (!view || !circuit) return;
    
    const numQubits = circuit.num_qubits();
    const depth = Math.max(getCircuitDepth(), 5);
    
    // Get the actual available width for the circuit view first
    let containerWidth = view.offsetWidth || view.getBoundingClientRect().width;
    
    // If width is 0 or very small, it might not be laid out yet - use parent width as fallback
    if (!containerWidth || containerWidth < 100) {
        const parent = view.parentElement;
        if (parent) {
            containerWidth = parent.offsetWidth - 40; // Subtract padding (20px * 2)
        }
    }
    
    // Final fallback
    if (!containerWidth || containerWidth < 100) {
        containerWidth = 800;
    }
    
    const spacing = 100;
    const qubitSpacing = 80;
    const startX = 100;
    
    // Performance optimization: Only use viewport culling for large circuits
    // Threshold: circuits with 50+ qubits benefit from viewport culling
    const VIEWPORT_CULLING_THRESHOLD = 50;
    const isLargeCircuit = numQubits >= VIEWPORT_CULLING_THRESHOLD;
    
    // Calculate visible qubit range for large circuits
    let visibleQubitStart = 0;
    let visibleQubitEnd = numQubits;
    
    if (isLargeCircuit) {
        // Get viewport scroll position
        const scrollTop = view.scrollTop || 0;
        const viewportHeight = view.clientHeight || view.getBoundingClientRect().height;
        
        // Calculate which qubits are visible
        // Qubit y position: 40 + qubitIndex * qubitSpacing
        // Visible range: from (scrollTop - 40) / qubitSpacing to (scrollTop + viewportHeight - 40) / qubitSpacing
        visibleQubitStart = Math.max(0, Math.floor((scrollTop - 40) / qubitSpacing));
        visibleQubitEnd = Math.min(numQubits, Math.ceil((scrollTop + viewportHeight - 40) / qubitSpacing) + 1);
        
        // Add padding to ensure smooth scrolling (render a bit more than visible)
        const padding = 5; // Render 5 extra qubits above and below
        visibleQubitStart = Math.max(0, visibleQubitStart - padding);
        visibleQubitEnd = Math.min(numQubits, visibleQubitEnd + padding);
    }
    
    // Calculate the width needed for the circuit based on depth
    // Add extra space for expansion (5 more time slots)
    const circuitWidth = (depth + 5) * spacing + startX;
    
    // SIMPLE constant expansion: find max time slot, always add 15 empty slots beyond it
    const EXPANSION_SLOTS = 15; // Constant number of empty slots beyond the rightmost gate
    let maxTimeSlot = -1;
    try {
        const gates = circuit.get_gates();
        if (Array.isArray(gates)) {
            gates.forEach((gate, idx) => {
                const timeSlot = gateTimePositions.get(idx);
                if (timeSlot !== undefined && timeSlot > maxTimeSlot) {
                    maxTimeSlot = timeSlot;
                }
            });
        }
    } catch (e) {
        // Ignore errors
    }
    // Calculate rightmost gate position (0 if no gates)
    const rightmostGateSlot = maxTimeSlot >= 0 ? maxTimeSlot : -1;
    // Always ensure we have exactly 15 empty slots beyond the rightmost gate
    const maxClickAreaSlots = (rightmostGateSlot + 1) + EXPANSION_SLOTS;
    const clickAreaWidth = maxClickAreaSlots * spacing + startX;
    
    // Use the larger of container width, circuit width, or click area width
    const displayWidth = Math.max(containerWidth, circuitWidth, clickAreaWidth);
    
    // Calculate stage dimensions - SIMPLE: stage must be at least as wide as clickAreaWidth
    // This ensures all click areas are always on the canvas
    const stageContentHeight = numQubits * 80 + 40;
    const minHeight = numQubits * qubitSpacing + 40; // Minimum height to show all qubits
    
    // Stage width MUST be at least clickAreaWidth to accommodate all click areas
    // Also ensure it's at least containerWidth for initial display
    const stageWidth = Math.max(containerWidth, clickAreaWidth);
    const aspectRatio = stageContentHeight / Math.max(clickAreaWidth, containerWidth);
    const stageHeight = Math.max(stageWidth * aspectRatio, minHeight);
    
    // Create or update Konva stage
    if (!konvaStage) {
        // Clear any existing content
        view.innerHTML = '';
        
        konvaStage = new Konva.Stage({
            container: 'circuit-view',
            width: stageWidth,
            height: stageHeight
        });
        
        // Prevent browser context menu on the canvas container
        // But allow Konva contextmenu events to work by only preventing if not handled by Konva
        const stageContainer = konvaStage.container();
        stageContainer.addEventListener('contextmenu', (e) => {
            // Only prevent if the event target is the container itself (not a Konva node)
            // Konva nodes will handle their own contextmenu events
            if (e.target === stageContainer || e.target.tagName === 'CANVAS') {
                e.preventDefault();
            }
        }, true); // Use capture phase to check before Konva handles it
        
        // Create two layers: static (qubit lines, labels) and dynamic (gates, click areas)
        staticLayer = new Konva.Layer();
        konvaLayer = new Konva.Layer();
        konvaStage.add(staticLayer);
        konvaStage.add(konvaLayer); // Dynamic layer on top
    } else {
        konvaStage.width(stageWidth);
        konvaStage.height(stageHeight);
    }
    
    // Clear the dynamic layer (gates, click areas, errors)
    konvaLayer.destroyChildren();
    clickAreaMap.clear();
    
    // Clear static layer if it exists (will redraw static elements)
    if (staticLayer) {
        staticLayer.destroyChildren();
    }
    
    // Add background highlighting for executed time slots (static - changes with currentTime)
    const highlightTopY = 0;
    const highlightBottomY = 40 + numQubits * qubitSpacing;
    const highlightHeight = highlightBottomY - highlightTopY;
    
    for (let t = 0; t < currentTime; t++) {
        const x = startX + t * spacing;
        const highlightRect = new Konva.Rect({
            x: x - spacing / 2,
            y: highlightTopY,
            width: spacing,
            height: highlightHeight,
            fill: '#c7c5c7',
            opacity: 0.5,
            cornerRadius: 4,
            listening: false,
        });
        staticLayer.add(highlightRect);
        highlightRect.moveToBottom();
    }
    
    // Calculate the width to draw qubit lines - extend to fill container or circuit width
    const lineEndX = Math.max(displayWidth - startX, depth * spacing);
    
    // Add light grid separators in empty areas to show the grid structure
    const maxTimeSlotsForGrid = Math.ceil((displayWidth - startX) / spacing);
    const topY = 0;
    const bottomY = 40 + numQubits * qubitSpacing;
    
    // Add light grid lines for empty time slots (beyond depth)
    for (let t = depth; t < maxTimeSlotsForGrid; t++) {
        const x = startX + (t + 0.5) * spacing;
        const gridLine = new Konva.Line({
            points: [x, topY, x, bottomY],
            stroke: '#f0f0f0',
            strokeWidth: 1,
            dash: [2, 4],
            opacity: 0.5,
            listening: false,
        });
        staticLayer.add(gridLine);
        gridLine.moveToBottom();
    }
    
    // Render qubit lines and labels
    // For large circuits, only render visible qubits
    const qubitsToRender = isLargeCircuit 
        ? { start: visibleQubitStart, end: visibleQubitEnd }
        : { start: 0, end: numQubits };
    
    for (let q = qubitsToRender.start; q < qubitsToRender.end; q++) {
        const y = 40 + q * qubitSpacing;
        
        // Qubit line - highlight if this is the pending control qubit for two-qubit gate
        const isPendingControl = pendingTwoQubitGate && pendingTwoQubitGate.controlQubit === q;
        const line = new Konva.Line({
            points: [startX, y, startX + lineEndX, y],
            stroke: isPendingControl ? '#6A9DCE' : '#ddd',
            strokeWidth: isPendingControl ? 3 : 2,
            listening: false,
        });
        staticLayer.add(line);
        line.moveToBottom();
        
        // Qubit label - highlight if this is the pending control qubit
        const label = new Konva.Text({
            x: 20,
            y: y,
            text: `Q${q}`,
            fontSize: 18,
            fontFamily: 'Courier New',
            fontStyle: '600',
            fill: isPendingControl ? '#6A9DCE' : '#333',
            align: 'left',
            verticalAlign: 'middle',
            listening: false,
        });
        staticLayer.add(label);
        label.zIndex(1);
        
        // For large circuits, only create click areas for visible time slots + padding
        // For small circuits, create click areas for all slots up to maxClickAreaSlots
        let clickAreaStartTime = 0;
        let clickAreaEndTime = maxClickAreaSlots;
        
        if (isLargeCircuit) {
            // Calculate visible time slot range based on horizontal scroll
            const scrollLeft = view.scrollLeft || 0;
            const viewportRight = scrollLeft + containerWidth;
            const visibleStartTime = Math.max(0, Math.floor((scrollLeft - startX) / spacing) - 2); // 2 slots padding before
            const visibleEndTime = Math.ceil((viewportRight - startX) / spacing) + 2; // 2 slots padding after
            
            // But always ensure we have click areas up to maxClickAreaSlots for expansion
            clickAreaStartTime = Math.max(0, Math.min(visibleStartTime, maxClickAreaSlots - 20)); // Keep some before visible
            clickAreaEndTime = Math.max(visibleEndTime, maxClickAreaSlots); // Always include expansion area
        }
        
        // Create click areas for gate placement
        for (let t = clickAreaStartTime; t <= clickAreaEndTime; t++) {
            const x = startX + t * spacing;
            // Allow click areas beyond displayWidth to enable expansion
            
            const clickArea = new Konva.Rect({
                x: x - spacing / 2,
                y: y - qubitSpacing / 2,
                width: spacing,
                height: qubitSpacing,
                fill: 'transparent',
                name: 'gate-placement-area',
                listening: true,
            });
            
            // Store qubit and time data
            clickArea.setAttr('data-qubit', q);
            clickArea.setAttr('data-time', t);
            clickArea.setAttr('_isGateHovered', false);
            
            // Store in map for hover coordination
            const key = `${q}-${t}`;
            clickAreaMap.set(key, clickArea);
            
            // Event handlers
            clickArea.on('click', (e) => {
                // Only handle click if it's a left click (not right click)
                if (e.evt.button === 0 || e.evt.button === undefined) {
                    handleCircuitClick({ qubit: q, time: t });
                }
            });
            
            clickArea.on('contextmenu', (e) => {
                e.evt.preventDefault();
                e.evt.stopPropagation(); // Prevent event from bubbling to container
                handleCircuitRightClick({ qubit: q, time: t });
            });
            
            const highlightClickArea = (target) => {
                if (selectedGate) {
                    target.fill('rgba(52, 152, 219, 0.15)');
                    target.stroke('rgba(52, 152, 219, 0.5)');
                    target.strokeWidth(2);
                    target.dash([4, 4]);
                    konvaLayer.draw();
                }
            };
            
            const unhighlightClickArea = (target) => {
                if (!target.getAttr('_isGateHovered')) {
                    target.fill('transparent');
                    target.stroke(null);
                    target.strokeWidth(0);
                    target.dash([]);
                    konvaLayer.draw();
                }
            };
            
            clickArea.on('mouseenter', () => {
                clickArea.setAttr('_isGateHovered', false);
                highlightClickArea(clickArea);
                // Handle cursor
                if (selectedGate && konvaStage) {
                    konvaStage.container().style.cursor = 'pointer';
                }
            });
            
            clickArea.on('mouseleave', () => {
                unhighlightClickArea(clickArea);
                // Reset cursor
                if (konvaStage) {
                    konvaStage.container().style.cursor = 'default';
                }
            });
            
            konvaLayer.add(clickArea);
            // Don't set zIndex explicitly - use moveToTop() if needed, but click areas should be on top anyway
        }
    }
    
    // Render gates
    try {
        const gates = circuit.get_gates();
        if (Array.isArray(gates)) {
            const gateTimeMap = new Map();
            
            gates.forEach((gate, idx) => {
                if (gate && (gate.Single || gate.Two)) {
                    let timeSlot = gateTimePositions.get(idx);
                    
                    if (timeSlot === undefined) {
                        let qubits = [];
                        if (gate.Single) {
                            qubits = [gate.Single.qubit];
                        } else if (gate.Two) {
                            if (gate.Two.CNOT) {
                                qubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                            } else if (gate.Two.CZ) {
                                qubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                            } else if (gate.Two.SWAP) {
                                qubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                            }
                        }
                        
                        for (let t = 0; t <= depth; t++) {
                            const gatesAtTime = gateTimeMap.get(t) || [];
                            const hasConflict = gatesAtTime.some(({gate: g, idx: gIdx}) => {
                                const gTime = gateTimePositions.get(gIdx);
                                if (gTime !== undefined && gTime === t) {
                                    let gQubits = [];
                                    if (g.Single) gQubits = [g.Single.qubit];
                                    else if (g.Two) {
                                        if (g.Two.CNOT) gQubits = [g.Two.CNOT.control, g.Two.CNOT.target];
                                        else if (g.Two.CZ) gQubits = [g.Two.CZ.control, g.Two.CZ.target];
                                        else if (g.Two.SWAP) gQubits = [g.Two.SWAP.qubit1, g.Two.SWAP.qubit2];
                                    }
                                    return qubits.some(q => gQubits.includes(q));
                                }
                                return false;
                            });
                            
                            if (!hasConflict) {
                                timeSlot = t;
                                gateTimePositions.set(idx, t);
                                break;
                            }
                        }
                    }
                    
                    if (!gateTimeMap.has(timeSlot)) {
                        gateTimeMap.set(timeSlot, []);
                    }
                    gateTimeMap.get(timeSlot).push({gate, idx});
                } else {
                    console.warn('Invalid gate at index', idx, ':', gate);
                }
            });
            
            // Helper function to check if a gate should be rendered (for large circuits)
            const shouldRenderGate = (gate) => {
                if (!isLargeCircuit) return true; // Always render for small circuits
                
                // Extract qubits from gate
                let gateQubits = [];
                if (gate.Single) {
                    gateQubits = [gate.Single.qubit];
                } else if (gate.Two) {
                    if (gate.Two.CNOT) {
                        gateQubits = [gate.Two.CNOT.control, gate.Two.CNOT.target];
                    } else if (gate.Two.CZ) {
                        gateQubits = [gate.Two.CZ.control, gate.Two.CZ.target];
                    } else if (gate.Two.SWAP) {
                        gateQubits = [gate.Two.SWAP.qubit1, gate.Two.SWAP.qubit2];
                    }
                }
                
                // Render gate if ANY of its qubits are visible
                return gateQubits.some(q => q >= visibleQubitStart && q < visibleQubitEnd);
            };
            
            gateTimeMap.forEach((gatesAtTime, timeSlot) => {
                // Sort gates: render two-qubit gates first, then single-qubit gates
                // This ensures overlapping single-qubit gates (which have higher z-index) are rendered last
                // and will be on top when moveToTop() is called
                const sortedGates = [...gatesAtTime].sort((a, b) => {
                    // Two-qubit gates first (return -1), then single-qubit gates (return 1)
                    const aIsTwo = a.gate.Two ? true : false;
                    const bIsTwo = b.gate.Two ? true : false;
                    if (aIsTwo && !bIsTwo) return -1;
                    if (!aIsTwo && bIsTwo) return 1;
                    return 0; // Keep original order within same type
                });
                
                sortedGates.forEach(({gate}) => {
                    // Only render gate if it's on visible qubits (for large circuits)
                    if (shouldRenderGate(gate)) {
                        // Pass all gates at this time step for context (for coloring and overlap handling)
                        renderGate(konvaLayer, gate, timeSlot, spacing, qubitSpacing, startX, clickAreaMap, gatesAtTime);
                    }
                });
            });
        } else {
            console.warn('Gates is not an array:', gates, typeof gates);
        }
    } catch (e) {
        console.error('Error rendering gates:', e);
    }
    
    // Render initial errors at time 0
    // For large circuits, only render errors on visible qubits
    if (initialError) {
        Object.keys(initialError).forEach(q => {
            const qubitIndex = parseInt(q);
            // Only render error if qubit is visible (or circuit is small)
            if (!isLargeCircuit || (qubitIndex >= visibleQubitStart && qubitIndex < visibleQubitEnd)) {
                const error = initialError[q];
                if (error && error !== 'I') {
                    renderError(konvaLayer, error, qubitIndex, 0, spacing, qubitSpacing, startX);
                }
            }
        });
    }
    
    // Update separators (on static layer)
    updateTimeSeparators();
    
    // Batch draw both layers for better performance
    if (staticLayer) {
        staticLayer.batchDraw();
    }
    konvaLayer.batchDraw();
    
    // Attach scroll listener for large circuits to update visible qubits and click areas on scroll
    // Only attach once and only for large circuits
    if (isLargeCircuit && !scrollListenerAttached && konvaStage) {
        const view = document.getElementById('circuit-view');
        if (view) {
            view.addEventListener('scroll', () => {
                // Ignore scroll events during programmatic auto-scroll
                if (isAutoScrolling) {
                    return;
                }
                
                // Clear existing timeout
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }
                
                // Debounce scroll events - only re-render after scrolling stops
                // This updates both visible qubits (vertical scroll) and click areas (horizontal scroll)
                scrollTimeout = setTimeout(() => {
                    // Only re-render if we're still dealing with a large circuit
                    const currentNumQubits = circuit ? circuit.num_qubits() : 0;
                    if (currentNumQubits >= VIEWPORT_CULLING_THRESHOLD) {
                        renderCircuit();
                    }
                }, 50); // 50ms debounce
            }, { passive: true });
            scrollListenerAttached = true;
        }
    }
    
    // Check if we need to show empty hint
    const gates = circuit.get_gates();
    const hasGates = gates && Array.isArray(gates) && gates.length > 0;
    const hasErrors = simulator && (() => {
        const errorPattern = simulator.get_error_pattern();
        for (let q = 0; q < numQubits; q++) {
            if (errorPattern.get_pauli(q) !== 'I') return true;
        }
        return false;
    })();
    
    // Remove existing hint if any
    const existingHint = view.querySelector('.circuit-empty-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    if (!hasGates && !hasErrors) {
        const hint = document.createElement('div');
        hint.className = 'circuit-empty-hint';
        hint.innerHTML = `
            <div style="margin-bottom: 8px; color: #666;">1. Select the gates from the left panel</div>
            <div style="margin-bottom: 8px; color: #666;">2. Click on the circuit above to (re)place them. Right click on gates on the circuit to remove them</div>
            <div style="margin-bottom: 8px; color: #666;">3. Inject errors using the error buttons</div>
            <div style="color: #666;">4. Use step buttons below to step through the circuit</div>
        `;
        view.appendChild(hint);
    }
    
    // Auto-scroll to the right only if a gate was placed at a time slot beyond the visible area
    // This prevents auto-scrolling when gates are added to the left
    requestAnimationFrame(() => {
        setTimeout(() => {
            const currentDepth = getCircuitDepth();
            const scrollWidth = view.scrollWidth;
            const clientWidth = view.clientWidth;
            
            // Simple approach: if gate is placed in right half of visible area, expand and scroll
            if (lastPlacedGateTime >= 0 && scrollWidth > clientWidth) {
                const spacing = 100;
                const startX = 100;
                const gateX = startX + lastPlacedGateTime * spacing;
                const currentScrollLeft = view.scrollLeft;
                const visibleCenter = currentScrollLeft + (clientWidth / 2);
                
                // If gate is in right half of visible area, expand circuit and scroll
                if (gateX > visibleCenter) {
                    // Set flag to prevent scroll listener from firing during programmatic scroll
                    isAutoScrolling = true;
                    
                    // Position gate at 1/4 from left, leaving 3/4 visible on right for expansion
                    const targetScrollLeft = Math.max(0, gateX - (clientWidth * 0.25));
                    view.scrollLeft = targetScrollLeft;
                    
                    // Clear the flag after a short delay
                    setTimeout(() => {
                        isAutoScrolling = false;
                    }, 100);
                }
            }
            
            setPreviousCircuitDepth(currentDepth);
            // Reset lastPlacedGateTime after handling scroll
            if (lastPlacedGateTime >= 0) {
                setLastPlacedGateTime(-1);
            }
        }, 0);
    });
    
    // Expose Konva stage and layers for testing
    if (typeof window !== 'undefined') {
        window.konvaStage = konvaStage;
        window.konvaLayer = konvaLayer;
        window.staticLayer = staticLayer;
    }
}
