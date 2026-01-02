use crate::physics::circuit::Circuit;
use serde_json;

pub fn export_json(circuit: &Circuit) -> Result<String, String> {
    serde_json::to_string_pretty(circuit)
        .map_err(|e| format!("Failed to serialize circuit to JSON: {}", e))
}

pub fn import_json(json_str: &str) -> Result<Circuit, String> {
    serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};

    #[test]
    fn test_json_roundtrip() {
        let mut circuit = Circuit::new(2);
        circuit
            .add_gate(Gate::Single {
                qubit: 0,
                gate: SingleGate::H,
            })
            .unwrap();
        circuit
            .add_gate(Gate::Two(TwoGate::CNOT {
                control: 0,
                target: 1,
            }))
            .unwrap();

        let json = export_json(&circuit).unwrap();
        let imported = import_json(&json).unwrap();

        assert_eq!(circuit.num_qubits, imported.num_qubits);
        assert_eq!(circuit.gates.len(), imported.gates.len());
        assert_eq!(circuit.gates, imported.gates);
    }
}

