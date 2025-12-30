// WASM module loading
let init, WasmCircuit, WasmSimulator, WasmPauliString;

export async function loadWasm() {
    try {
        const wasmModule = await import('../wasm-pkg/quantum_error_analyzer_wasm.js');
        init = wasmModule.default;
        WasmCircuit = wasmModule.WasmCircuit;
        WasmSimulator = wasmModule.WasmSimulator;
        WasmPauliString = wasmModule.WasmPauliString;
        await init();
        return true;
    } catch (e) {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'padding: 20px; margin: 20px; background: #fee; border: 2px solid #f00; border-radius: 8px; color: #c00;';
        errorMsg.innerHTML = `
            <h2 style="margin-top: 0;">WASM Module Not Found</h2>
            <p>Please build the WASM module first:</p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">bun run build:wasm</pre>
            <p>Or run the full setup:</p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">bun run setup</pre>
        `;
        document.getElementById('app').appendChild(errorMsg);
        console.error('Failed to load WASM module:', e);
        return false;
    }
}

export { WasmCircuit, WasmSimulator, WasmPauliString };

