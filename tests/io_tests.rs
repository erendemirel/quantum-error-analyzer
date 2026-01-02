//! Integration tests for circuit import/export functionality
//!
//! Tests import/export using sample files from test_data directory.

use quantum_error_analyzer::io;
use quantum_error_analyzer::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use std::fs;
use std::path::PathBuf;

fn test_data_path(filename: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("tests");
    path.push("test_data");
    path.push(filename);
    path
}

fn load_test_file(filename: &str) -> String {
    let path = test_data_path(filename);
    fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("Failed to read test file {}: {}", filename, e))
}

#[test]
fn test_json_import_sample_circuit() {
    let json = load_test_file("sample_circuit.json");
    let circuit = io::import_json(&json).expect("Failed to import sample_circuit.json");
    
    assert_eq!(circuit.num_qubits, 3);
    assert_eq!(circuit.gates.len(), 5);
    
    // Verify first gate (H on qubit 0)
    match &circuit.gates[0] {
        Gate::Single { qubit, gate } => {
            assert_eq!(*qubit, 0);
            assert_eq!(*gate, SingleGate::H);
        }
        _ => panic!("Expected Single gate"),
    }
    
    // Verify CNOT gate
    match &circuit.gates[2] {
        Gate::Two(TwoGate::CNOT { control, target }) => {
            assert_eq!(*control, 0);
            assert_eq!(*target, 2);
        }
        _ => panic!("Expected CNOT gate"),
    }
}

#[test]
fn test_json_import_bell_state() {
    let json = load_test_file("bell_state.json");
    let circuit = io::import_json(&json).expect("Failed to import bell_state.json");
    
    assert_eq!(circuit.num_qubits, 2);
    assert_eq!(circuit.gates.len(), 2);
    
    // Verify it's a Bell state circuit (H then CNOT)
    match &circuit.gates[0] {
        Gate::Single { qubit, gate } => {
            assert_eq!(*qubit, 0);
            assert_eq!(*gate, SingleGate::H);
        }
        _ => panic!("Expected H gate"),
    }
    
    match &circuit.gates[1] {
        Gate::Two(TwoGate::CNOT { control, target }) => {
            assert_eq!(*control, 0);
            assert_eq!(*target, 1);
        }
        _ => panic!("Expected CNOT gate"),
    }
}

#[test]
fn test_json_import_export_roundtrip() {
    let json = load_test_file("sample_circuit.json");
    let original = io::import_json(&json).expect("Failed to import");
    
    // Export and re-import
    let exported = io::export_json(&original).expect("Failed to export");
    let imported = io::import_json(&exported).expect("Failed to re-import");
    
    assert_eq!(original.num_qubits, imported.num_qubits);
    assert_eq!(original.gates.len(), imported.gates.len());
    assert_eq!(original.gates, imported.gates);
}

#[test]
fn test_json_import_all_gates() {
    let json = load_test_file("all_gates.json");
    let circuit = io::import_json(&json).expect("Failed to import all_gates.json");
    
    assert_eq!(circuit.num_qubits, 3);
    assert_eq!(circuit.gates.len(), 9);
    
    // Verify all single-qubit gates are present
    let single_gates: Vec<&Gate> = circuit.gates.iter()
        .filter(|g| matches!(g, Gate::Single { .. }))
        .collect();
    assert_eq!(single_gates.len(), 6);
    
    // Verify all two-qubit gates are present
    let two_gates: Vec<&Gate> = circuit.gates.iter()
        .filter(|g| matches!(g, Gate::Two(_)))
        .collect();
    assert_eq!(two_gates.len(), 3);
}

#[test]
fn test_qasm_import_sample_circuit() {
    let qasm = load_test_file("sample_circuit.qasm");
    let circuit = io::import_qasm(&qasm).expect("Failed to import sample_circuit.qasm");
    
    assert_eq!(circuit.num_qubits, 3);
    assert_eq!(circuit.gates.len(), 5);
    
    // Verify first gate (H on qubit 0)
    match &circuit.gates[0] {
        Gate::Single { qubit, gate } => {
            assert_eq!(*qubit, 0);
            assert_eq!(*gate, SingleGate::H);
        }
        _ => panic!("Expected Single gate"),
    }
}

#[test]
fn test_qasm_import_bell_state() {
    let qasm = load_test_file("bell_state.qasm");
    let circuit = io::import_qasm(&qasm).expect("Failed to import bell_state.qasm");
    
    assert_eq!(circuit.num_qubits, 2);
    assert_eq!(circuit.gates.len(), 2);
    
    // Verify it's a Bell state circuit
    match &circuit.gates[0] {
        Gate::Single { qubit, gate } => {
            assert_eq!(*qubit, 0);
            assert_eq!(*gate, SingleGate::H);
        }
        _ => panic!("Expected H gate"),
    }
    
    match &circuit.gates[1] {
        Gate::Two(TwoGate::CNOT { control, target }) => {
            assert_eq!(*control, 0);
            assert_eq!(*target, 1);
        }
        _ => panic!("Expected CNOT gate"),
    }
}

#[test]
fn test_qasm_import_export_roundtrip() {
    let qasm = load_test_file("sample_circuit.qasm");
    let original = io::import_qasm(&qasm).expect("Failed to import");
    
    // Export and re-import
    let exported = io::export_qasm(&original);
    let imported = io::import_qasm(&exported).expect("Failed to re-import");
    
    assert_eq!(original.num_qubits, imported.num_qubits);
    assert_eq!(original.gates.len(), imported.gates.len());
}

#[test]
fn test_qasm_import_complex_circuit() {
    let qasm = load_test_file("complex_circuit.qasm");
    let circuit = io::import_qasm(&qasm).expect("Failed to import complex_circuit.qasm");
    
    assert_eq!(circuit.num_qubits, 4);
    assert_eq!(circuit.gates.len(), 8);
}

#[test]
fn test_qasm_import_all_gates() {
    let qasm = load_test_file("all_gates.qasm");
    let circuit = io::import_qasm(&qasm).expect("Failed to import all_gates.qasm");
    
    assert_eq!(circuit.num_qubits, 3);
    assert_eq!(circuit.gates.len(), 9);
    
    // Verify Sdg gate is present (as sdg in QASM)
    let has_sdg = circuit.gates.iter().any(|g| {
        matches!(g, Gate::Single { gate: SingleGate::Sdg, .. })
    });
    assert!(has_sdg, "Expected Sdg gate in circuit");
}

#[test]
fn test_cross_format_consistency() {
    // Import from JSON and QASM, compare results
    let json = load_test_file("bell_state.json");
    let qasm = load_test_file("bell_state.qasm");
    
    let circuit_from_json = io::import_json(&json).expect("Failed to import JSON");
    let circuit_from_qasm = io::import_qasm(&qasm).expect("Failed to import QASM");
    
    assert_eq!(circuit_from_json.num_qubits, circuit_from_qasm.num_qubits);
    assert_eq!(circuit_from_json.gates.len(), circuit_from_qasm.gates.len());
    assert_eq!(circuit_from_json.gates, circuit_from_qasm.gates);
}

#[test]
fn test_latex_export_sample_circuit() {
    let json = load_test_file("sample_circuit.json");
    let circuit = io::import_json(&json).expect("Failed to import");
    
    let latex = io::export_latex(&circuit);
    
    // Verify LaTeX contains expected elements
    assert!(latex.contains("\\documentclass{article}"));
    assert!(latex.contains("qcircuit"));
    assert!(latex.contains("\\Qcircuit"));
}

#[test]
fn test_latex_export_simple() {
    let json = load_test_file("bell_state.json");
    let circuit = io::import_json(&json).expect("Failed to import");
    
    let latex = io::export_latex_simple(&circuit);
    
    // Verify LaTeX contains expected elements
    assert!(latex.contains("\\documentclass{article}"));
    assert!(latex.contains(&format!("{} qubits", circuit.num_qubits)));
    assert!(latex.contains(&format!("{} gates", circuit.gates.len())));
}

#[test]
fn test_json_to_qasm_export() {
    // Import from JSON, export to QASM
    let json = load_test_file("sample_circuit.json");
    let circuit = io::import_json(&json).expect("Failed to import JSON");
    
    let qasm = io::export_qasm(&circuit);
    
    // Verify QASM format
    assert!(qasm.contains("OPENQASM 2.0"));
    assert!(qasm.contains("qreg q[3]"));
    assert!(qasm.contains("h q[0]"));
}

#[test]
fn test_qasm_to_json_export() {
    // Import from QASM, export to JSON
    let qasm = load_test_file("sample_circuit.qasm");
    let circuit = io::import_qasm(&qasm).expect("Failed to import QASM");
    
    let json = io::export_json(&circuit).expect("Failed to export JSON");
    
    // Verify JSON format
    assert!(json.contains("\"num_qubits\""));
    assert!(json.contains("\"gates\""));
    
    // Re-import to verify it's valid
    let reimported = io::import_json(&json).expect("Failed to re-import JSON");
    assert_eq!(circuit.num_qubits, reimported.num_qubits);
    assert_eq!(circuit.gates.len(), reimported.gates.len());
}

#[test]
fn test_complex_circuit_roundtrip_json() {
    let json = load_test_file("complex_circuit.json");
    let original = io::import_json(&json).expect("Failed to import");
    
    // Export and re-import
    let exported = io::export_json(&original).expect("Failed to export");
    let imported = io::import_json(&exported).expect("Failed to re-import");
    
    assert_eq!(original.num_qubits, imported.num_qubits);
    assert_eq!(original.gates.len(), imported.gates.len());
    assert_eq!(original.gates, imported.gates);
}

#[test]
fn test_complex_circuit_roundtrip_qasm() {
    let qasm = load_test_file("complex_circuit.qasm");
    let original = io::import_qasm(&qasm).expect("Failed to import");
    
    // Export and re-import
    let exported = io::export_qasm(&original);
    let imported = io::import_qasm(&exported).expect("Failed to re-import");
    
    assert_eq!(original.num_qubits, imported.num_qubits);
    assert_eq!(original.gates.len(), imported.gates.len());
}

#[test]
fn test_empty_circuit_export() {
    let circuit = Circuit::new(3);
    
    // Test JSON export/import
    let json = io::export_json(&circuit).expect("Failed to export empty circuit");
    let imported = io::import_json(&json).expect("Failed to import empty circuit");
    assert_eq!(circuit.num_qubits, imported.num_qubits);
    assert_eq!(circuit.gates.len(), imported.gates.len());
    
    // Test QASM export/import
    let qasm = io::export_qasm(&circuit);
    let imported = io::import_qasm(&qasm).expect("Failed to import empty circuit from QASM");
    assert_eq!(circuit.num_qubits, imported.num_qubits);
    assert_eq!(circuit.gates.len(), imported.gates.len());
}

#[test]
fn test_single_gate_circuit() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    // Test JSON roundtrip
    let json = io::export_json(&circuit).expect("Failed to export");
    let imported = io::import_json(&json).expect("Failed to import");
    assert_eq!(circuit.gates, imported.gates);
    
    // Test QASM roundtrip
    let qasm = io::export_qasm(&circuit);
    let imported = io::import_qasm(&qasm).expect("Failed to import");
    assert_eq!(circuit.gates.len(), imported.gates.len());
}

