use wasm_bindgen::prelude::*;

use quantum_error_analyzer::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use quantum_error_analyzer::physics::pauli::{PauliString, SinglePauli, Phase};
use quantum_error_analyzer::physics::simulator::Simulator;

#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmCircuit {
    circuit: Circuit,
}

#[wasm_bindgen]
impl WasmCircuit {
    #[wasm_bindgen(constructor)]
    pub fn new(num_qubits: usize) -> WasmCircuit {
        WasmCircuit {
            circuit: Circuit::new(num_qubits),
        }
    }

    #[wasm_bindgen]
    pub fn add_single_gate(&mut self, qubit: usize, gate_type: String) -> Result<(), String> {
        let gate = match gate_type.as_str() {
            "H" => SingleGate::H,
            "S" => SingleGate::S,
            "Sdg" => SingleGate::Sdg,
            "X" => SingleGate::X,
            "Y" => SingleGate::Y,
            "Z" => SingleGate::Z,
            "I" => SingleGate::I,
            _ => return Err(format!("Unknown gate type: {}", gate_type)),
        };

        self.circuit.add_gate(Gate::Single { qubit, gate })
    }

    #[wasm_bindgen]
    pub fn add_cnot(&mut self, control: usize, target: usize) -> Result<(), String> {
        self.circuit.add_gate(Gate::Two(TwoGate::CNOT { control, target }))
    }

    #[wasm_bindgen]
    pub fn add_cz(&mut self, control: usize, target: usize) -> Result<(), String> {
        self.circuit.add_gate(Gate::Two(TwoGate::CZ { control, target }))
    }

    #[wasm_bindgen]
    pub fn add_swap(&mut self, qubit1: usize, qubit2: usize) -> Result<(), String> {
        self.circuit.add_gate(Gate::Two(TwoGate::SWAP { qubit1, qubit2 }))
    }

    #[wasm_bindgen]
    pub fn num_qubits(&self) -> usize {
        self.circuit.num_qubits
    }

    #[wasm_bindgen]
    pub fn depth(&self) -> usize {
        self.circuit.depth()
    }

    #[wasm_bindgen]
    pub fn get_gates(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.circuit.gates).unwrap()
    }
}

#[wasm_bindgen]
pub struct WasmPauliString {
    pauli: PauliString,
}

#[wasm_bindgen]
impl WasmPauliString {
    #[wasm_bindgen(constructor)]
    pub fn new(num_qubits: usize) -> WasmPauliString {
        WasmPauliString {
            pauli: PauliString::new(num_qubits),
        }
    }

    #[wasm_bindgen]
    pub fn set_pauli(&mut self, qubit: usize, pauli_type: String) {
        let pauli = match pauli_type.as_str() {
            "X" => SinglePauli::X,
            "Y" => SinglePauli::Y,
            "Z" => SinglePauli::Z,
            "I" => SinglePauli::I,
            _ => SinglePauli::I,
        };
        self.pauli.set_pauli(qubit, pauli);
    }

    #[wasm_bindgen]
    pub fn get_pauli(&self, qubit: usize) -> String {
        match self.pauli.get_pauli(qubit) {
            SinglePauli::X => "X".to_string(),
            SinglePauli::Y => "Y".to_string(),
            SinglePauli::Z => "Z".to_string(),
            SinglePauli::I => "I".to_string(),
        }
    }

    #[wasm_bindgen]
    pub fn num_qubits(&self) -> usize {
        self.pauli.num_qubits()
    }

    #[wasm_bindgen]
    pub fn get_phase(&self) -> String {
        match self.pauli.phase() {
            Phase::PlusOne => "".to_string(),
            Phase::MinusOne => "-".to_string(),
            Phase::PlusI => "i".to_string(),
            Phase::MinusI => "-i".to_string(),
        }
    }

    #[wasm_bindgen]
    pub fn to_string(&self) -> String {
        let mut result = String::new();
        for qubit in 0..self.pauli.num_qubits() {
            result.push_str(&self.get_pauli(qubit));
        }
        result
    }
}

#[wasm_bindgen]
pub struct WasmSimulator {
    simulator: Simulator,
}

#[wasm_bindgen]
impl WasmSimulator {
    #[wasm_bindgen(constructor)]
    pub fn new(circuit: &WasmCircuit) -> WasmSimulator {
        WasmSimulator {
            simulator: Simulator::new(circuit.circuit.clone()),
        }
    }

    #[wasm_bindgen]
    pub fn inject_error(&mut self, qubit: usize, pauli_type: String) {
        let pauli = match pauli_type.as_str() {
            "X" => SinglePauli::X,
            "Y" => SinglePauli::Y,
            "Z" => SinglePauli::Z,
            "I" => SinglePauli::I,
            _ => SinglePauli::I,
        };
        self.simulator.inject_error(qubit, pauli);
    }

    #[wasm_bindgen]
    pub fn step_forward(&mut self) -> bool {
        self.simulator.step_forward()
    }

    #[wasm_bindgen]
    pub fn step_backward(&mut self) -> bool {
        self.simulator.step_backward()
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.simulator.reset();
    }

    #[wasm_bindgen]
    pub fn current_time(&self) -> usize {
        self.simulator.current_time()
    }

    #[wasm_bindgen]
    pub fn get_error_pattern(&self) -> WasmPauliString {
        WasmPauliString {
            pauli: self.simulator.error_pattern().clone(),
        }
    }

    #[wasm_bindgen]
    pub fn run(&mut self) {
        self.simulator.run();
    }

    #[wasm_bindgen]
    pub fn get_timeline(&self) -> JsValue {
        use serde::{Serialize, Deserialize};
        #[derive(Serialize, Deserialize)]
        struct SnapshotData {
            time: usize,
            error_pattern: String,
            gate_applied: Option<usize>,
        }
        
        let timeline: Vec<SnapshotData> = self.simulator.timeline()
            .iter()
            .map(|snapshot| {
                let mut pattern = String::new();
                for q in 0..snapshot.error_pattern.num_qubits() {
                    match snapshot.error_pattern.get_pauli(q) {
                        SinglePauli::X => pattern.push('X'),
                        SinglePauli::Y => pattern.push('Y'),
                        SinglePauli::Z => pattern.push('Z'),
                        SinglePauli::I => pattern.push('I'),
                    }
                }
                SnapshotData {
                    time: snapshot.time,
                    error_pattern: pattern,
                    gate_applied: snapshot.gate_applied,
                }
            })
            .collect();
        
        serde_wasm_bindgen::to_value(&timeline).unwrap()
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

