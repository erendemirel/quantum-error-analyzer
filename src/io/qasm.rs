//! OpenQASM 2.0 format

use crate::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use std::collections::HashMap;

pub fn export_qasm(circuit: &Circuit) -> String {
    let mut qasm = String::from("OPENQASM 2.0;\n");
    qasm.push_str("include \"qelib1.inc\";\n");
    qasm.push_str(&format!("qreg q[{}];\n", circuit.num_qubits));
    qasm.push('\n');

    for gate in &circuit.gates {
        match gate {
            Gate::Single { qubit, gate } => {
                let gate_name = match gate {
                    SingleGate::H => "h",
                    SingleGate::S => "s",
                    SingleGate::Sdg => "sdg",
                    SingleGate::X => "x",
                    SingleGate::Y => "y",
                    SingleGate::Z => "z",
                    SingleGate::I => continue, // Identity gates are not included in QASM
                };
                qasm.push_str(&format!("{} q[{}];\n", gate_name, qubit));
            }
            Gate::Two(two_gate) => match two_gate {
                TwoGate::CNOT { control, target } => {
                    qasm.push_str(&format!("cx q[{}],q[{}];\n", control, target));
                }
                TwoGate::CZ { control, target } => {
                    qasm.push_str(&format!("cz q[{}],q[{}];\n", control, target));
                }
                TwoGate::SWAP { qubit1, qubit2 } => {
                    qasm.push_str(&format!("swap q[{}],q[{}];\n", qubit1, qubit2));
                }
            },
        }
    }

    qasm
}

pub fn import_qasm(qasm_str: &str) -> Result<Circuit, String> {
    let mut circuit = Circuit::new(0);
    let mut num_qubits = 0;
    let mut qubit_map: HashMap<String, usize> = HashMap::new();

    for line in qasm_str.lines() {
        let line = line.trim();
        
        // Skip comments and empty lines
        if line.is_empty() || line.starts_with("//") || line.starts_with("OPENQASM") || line.starts_with("include") {
            continue;
        }

        // Parse qreg declaration
        if line.starts_with("qreg ") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                // Format: qreg q[5];
                let reg_part = parts[1];
                if let Some(start) = reg_part.find('[') {
                    if let Some(end) = reg_part.find(']') {
                        if let Ok(n) = reg_part[start + 1..end].parse::<usize>() {
                            num_qubits = n;
                            circuit = Circuit::new(num_qubits);
                            // Map q[0], q[1], etc. to indices
                            for i in 0..n {
                                qubit_map.insert(format!("q[{}]", i), i);
                            }
                        }
                    }
                }
            }
            continue;
        }

        // Parse gate operations
        if line.ends_with(';') {
            let gate_line = &line[..line.len() - 1]; // Remove semicolon
            let parts: Vec<&str> = gate_line.split_whitespace().collect();
            
            if parts.is_empty() {
                continue;
            }

            let gate_name = parts[0].to_lowercase();
            let qubits: Vec<&str> = if parts.len() > 1 {
                parts[1].split(',').collect()
            } else {
                vec![]
            };

            match gate_name.as_str() {
                "h" | "x" | "y" | "z" | "s" | "sdg" => {
                    if qubits.len() != 1 {
                        return Err(format!("Single-qubit gate {} requires exactly one qubit", gate_name));
                    }
                    let qubit_str = qubits[0].trim();
                    let qubit = parse_qubit_index(qubit_str, &qubit_map)?;
                    
                    let gate = match gate_name.as_str() {
                        "h" => SingleGate::H,
                        "x" => SingleGate::X,
                        "y" => SingleGate::Y,
                        "z" => SingleGate::Z,
                        "s" => SingleGate::S,
                        "sdg" => SingleGate::Sdg,
                        _ => return Err(format!("Unknown single-qubit gate: {}", gate_name)),
                    };
                    
                    circuit.add_gate(Gate::Single { qubit, gate })
                        .map_err(|e| format!("Failed to add gate: {}", e))?;
                }
                "cx" => {
                    if qubits.len() != 2 {
                        return Err("CNOT gate requires exactly two qubits".to_string());
                    }
                    let control = parse_qubit_index(qubits[0].trim(), &qubit_map)?;
                    let target = parse_qubit_index(qubits[1].trim(), &qubit_map)?;
                    
                    circuit.add_gate(Gate::Two(TwoGate::CNOT { control, target }))
                        .map_err(|e| format!("Failed to add gate: {}", e))?;
                }
                "cz" => {
                    if qubits.len() != 2 {
                        return Err("CZ gate requires exactly two qubits".to_string());
                    }
                    let control = parse_qubit_index(qubits[0].trim(), &qubit_map)?;
                    let target = parse_qubit_index(qubits[1].trim(), &qubit_map)?;
                    
                    circuit.add_gate(Gate::Two(TwoGate::CZ { control, target }))
                        .map_err(|e| format!("Failed to add gate: {}", e))?;
                }
                "swap" => {
                    if qubits.len() != 2 {
                        return Err("SWAP gate requires exactly two qubits".to_string());
                    }
                    let qubit1 = parse_qubit_index(qubits[0].trim(), &qubit_map)?;
                    let qubit2 = parse_qubit_index(qubits[1].trim(), &qubit_map)?;
                    
                    circuit.add_gate(Gate::Two(TwoGate::SWAP { qubit1, qubit2 }))
                        .map_err(|e| format!("Failed to add gate: {}", e))?;
                }
                _ => {
                    return Err(format!("Unsupported gate: {}", gate_name));
                }
            }
        }
    }

    if num_qubits == 0 {
        return Err("No qubit register found in QASM file".to_string());
    }

    Ok(circuit)
}

fn parse_qubit_index(qubit_str: &str, qubit_map: &HashMap<String, usize>) -> Result<usize, String> {
    // Try direct lookup first (e.g., "q[0]")
    if let Some(&index) = qubit_map.get(qubit_str) {
        return Ok(index);
    }
    
    // Try parsing as direct index
    if let Ok(index) = qubit_str.parse::<usize>() {
        return Ok(index);
    }
    
    Err(format!("Could not parse qubit index: {}", qubit_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qasm_export() {
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

        let qasm = export_qasm(&circuit);
        assert!(qasm.contains("qreg q[2]"));
        assert!(qasm.contains("h q[0]"));
        assert!(qasm.contains("cx q[0],q[1]"));
    }

    #[test]
    fn test_qasm_import() {
        let qasm = r#"
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
h q[0];
cx q[0],q[1];
"#;

        let circuit = import_qasm(qasm).unwrap();
        assert_eq!(circuit.num_qubits, 2);
        assert_eq!(circuit.gates.len(), 2);
    }

    #[test]
    fn test_qasm_roundtrip() {
        let mut circuit = Circuit::new(3);
        circuit
            .add_gate(Gate::Single {
                qubit: 0,
                gate: SingleGate::H,
            })
            .unwrap();
        circuit
            .add_gate(Gate::Single {
                qubit: 1,
                gate: SingleGate::S,
            })
            .unwrap();
        circuit
            .add_gate(Gate::Two(TwoGate::CNOT {
                control: 0,
                target: 2,
            }))
            .unwrap();
        circuit
            .add_gate(Gate::Two(TwoGate::CZ {
                control: 1,
                target: 2,
            }))
            .unwrap();

        let qasm = export_qasm(&circuit);
        let imported = import_qasm(&qasm).unwrap();

        assert_eq!(circuit.num_qubits, imported.num_qubits);
        assert_eq!(circuit.gates.len(), imported.gates.len());
    }
}

