//! Integration tests that mirror the manual test cases

use quantum_error_analyzer::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use quantum_error_analyzer::physics::pauli::SinglePauli;
use quantum_error_analyzer::physics::simulator::Simulator;

#[test]
fn test_case_1_bell_state_circuit() {
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
    assert_eq!(circuit.gates.len(), 2);
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
}

#[test]
fn test_case_2_cnot_x_propagation() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::X);
}

#[test]
fn test_case_3_cnot_z_propagation() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CNOT {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(1, SinglePauli::Z);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::I);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
}

#[test]
fn test_case_4_hadamard_conjugation() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
}

#[test]
fn test_case_5_phase_gate() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::S,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Y);
    assert_eq!(sim.error_pattern().phase(), quantum_error_analyzer::physics::pauli::Phase::PlusI);
}

#[test]
fn test_case_6_cz_gate() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::CZ {
        control: 0,
        target: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
}

#[test]
fn test_case_7_swap_gate() {
    let mut circuit = Circuit::new(2);
    circuit.add_gate(Gate::Two(TwoGate::SWAP {
        qubit1: 0,
        qubit2: 1,
    })).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    sim.inject_error(1, SinglePauli::Z);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::X);
}

#[test]
fn test_case_8_error_toggle_and_reset() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    
    sim.reset();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::I);
    assert_eq!(sim.current_time(), 0);
}

#[test]
fn test_case_9_step_backward() {
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
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    
    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_backward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    
    sim.step_backward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
}

#[test]
fn test_case_10_reset_simulation() {
    let mut circuit = Circuit::new(1);
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::H,
    }).unwrap();
    circuit.add_gate(Gate::Single {
        qubit: 0,
        gate: SingleGate::S,
    }).unwrap();
    
    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);
    
    sim.run();
    assert_eq!(sim.current_time(), 2);
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    
    sim.reset();
    assert_eq!(sim.current_time(), 0);
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::I);
}

