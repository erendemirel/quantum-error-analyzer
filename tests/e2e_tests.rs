//! End-to-end tests for the Quantum Error Analyzer CLI

use quantum_error_analyzer::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use quantum_error_analyzer::physics::pauli::SinglePauli;
use quantum_error_analyzer::physics::simulator::Simulator;

#[test]
fn test_bell_state_circuit_creation() {
    let mut circuit = Circuit::new(2);
    
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    assert_eq!(circuit.depth(), 2);
    assert_eq!(circuit.num_qubits, 2);
}

#[test]
fn test_error_propagation_bell_circuit() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
}

#[test]
fn test_cnot_x_propagation() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::X);
}

#[test]
fn test_cnot_z_propagation() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(1, SinglePauli::Z);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
}

#[test]
fn test_hadamard_conjugation() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
}

#[test]
fn test_phase_gate_conjugation() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::S,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Y);
}

#[test]
fn test_multi_qubit_circuit() {
    let mut circuit = Circuit::new(3);
    
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 1,
        target: 2,
    })).unwrap();
    
    assert_eq!(circuit.depth(), 3);
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.run();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    assert_eq!(sim.error_pattern().get_pauli(2), SinglePauli::I);
}

#[test]
fn test_cz_gate() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CZ {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
}

#[test]
fn test_swap_gate() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::SWAP {
        qubit1: 0,
        qubit2: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    sim.inject_error(1, SinglePauli::Z);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::X);
}

