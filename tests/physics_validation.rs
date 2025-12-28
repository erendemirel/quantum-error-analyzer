//! Comprehensive physics validation tests.
//!
//! These tests verify that our implementation matches known quantum identities
//! and is physically correct.

use quantum_error_analyzer::physics::pauli::{PauliString, Phase, SinglePauli};
use quantum_error_analyzer::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
use quantum_error_analyzer::physics::propagation::{apply_single_gate, apply_two_gate};
use quantum_error_analyzer::physics::simulator::Simulator;

#[test]
fn test_cnot_propagation_comprehensive() {
    let mut p = PauliString::from_str("X I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.get_pauli(1), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("I X", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::I);
    assert_eq!(p.get_pauli(1), SinglePauli::X);

    let mut p = PauliString::from_str("Z I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.get_pauli(1), SinglePauli::I);

    let mut p = PauliString::from_str("I Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.get_pauli(1), SinglePauli::Z);

    let mut p = PauliString::from_str("Y I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.get_pauli(1), SinglePauli::X);

    // Test XX: X on control spreads to target, but X on target commutes with CNOT
    // So XX should stay XX (not become XI)
    let mut p = PauliString::from_str("X X", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.get_pauli(1), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);
}

#[test]
fn test_hadamard_identities() {
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("Y", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.phase(), Phase::MinusOne);

    let mut p = PauliString::from_str("I", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    assert_eq!(p.get_pauli(0), SinglePauli::I);
}

#[test]
fn test_phase_gate_identities() {
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.phase(), Phase::PlusI);

    let mut p = PauliString::from_str("Y", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::MinusOne);

    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("I", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::I);
}

#[test]
fn test_phase_gate_dagger_identities() {
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.phase(), Phase::MinusI);

    let mut p = PauliString::from_str("Y", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
}

#[test]
fn test_phase_gate_inverse() {
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);
}

#[test]
fn test_pauli_gate_conjugation() {
    // X gate: X commutes with itself, Z anti-commutes
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::X);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::X);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.phase(), Phase::MinusOne);

    // Z gate: Z commutes with itself, X anti-commutes
    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Z);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Z);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::MinusOne);

    // Y gate: Y commutes with itself, X and Z anti-commute
    let mut p = PauliString::from_str("Y", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Y);
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.phase(), Phase::PlusOne);

    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Y);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::MinusOne);

    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Y);
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.phase(), Phase::MinusOne);

    let mut p = PauliString::from_str("I", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::Y);
    assert_eq!(p.get_pauli(0), SinglePauli::I);
    assert_eq!(p.phase(), Phase::PlusOne);
}

/// Test Pauli multiplication rules
#[test]
fn test_pauli_multiplication_identities() {
    // X * Z = iY
    let x = PauliString::from_str("X", 1).unwrap();
    let z = PauliString::from_str("Z", 1).unwrap();
    let result = x.multiply(&z);
    assert_eq!(result.get_pauli(0), SinglePauli::Y);
    assert_eq!(result.phase(), Phase::PlusI);

    // Z * X = -iY
    let result = z.multiply(&x);
    assert_eq!(result.get_pauli(0), SinglePauli::Y);
    assert_eq!(result.phase(), Phase::MinusI);

    // X * X = I
    let result = x.multiply(&x);
    assert_eq!(result.get_pauli(0), SinglePauli::I);
    assert_eq!(result.phase(), Phase::PlusOne);

    // Z * Z = I
    let result = z.multiply(&z);
    assert_eq!(result.get_pauli(0), SinglePauli::I);

    // Y * Y = I
    let y = PauliString::from_str("Y", 1).unwrap();
    let result = y.multiply(&y);
    assert_eq!(result.get_pauli(0), SinglePauli::I);
}

#[test]
fn test_cz_conjugation() {
    let mut p = PauliString::from_str("X I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CZ { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.get_pauli(1), SinglePauli::Z);

    let mut p = PauliString::from_str("I X", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CZ { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.get_pauli(1), SinglePauli::X);

    let mut p = PauliString::from_str("Z I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CZ { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.get_pauli(1), SinglePauli::I);

    let mut p = PauliString::from_str("I Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CZ { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::I);
    assert_eq!(p.get_pauli(1), SinglePauli::Z);
}

#[test]
fn test_swap_gate() {
    let mut p = PauliString::from_str("X I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::SWAP { qubit1: 0, qubit2: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::I);
    assert_eq!(p.get_pauli(1), SinglePauli::X);

    let mut p = PauliString::from_str("I Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::SWAP { qubit1: 0, qubit2: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Z);
    assert_eq!(p.get_pauli(1), SinglePauli::I);
}

#[test]
fn test_bell_state_circuit() {
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

    let mut sim = Simulator::new(circuit);
    sim.inject_error(0, SinglePauli::X);

    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);

    sim.step_forward();
    assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
    assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
}

#[test]
fn test_commutation_preservation() {
    let p1 = PauliString::from_str("X I", 2).unwrap();
    let p2 = PauliString::from_str("I X", 2).unwrap();
    
    assert!(p1.commutes_with(&p2));

    let mut p1_after = p1.clone();
    let mut p2_after = p2.clone();
    apply_two_gate(&mut p1_after, TwoGate::CNOT { control: 0, target: 1 });
    apply_two_gate(&mut p2_after, TwoGate::CNOT { control: 0, target: 1 });

    assert!(p1_after.commutes_with(&p2_after));
}

#[test]
fn test_multi_qubit_errors() {
    let mut p = PauliString::from_str("X Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.get_pauli(1), SinglePauli::Y);
}

#[test]
fn test_phase_accumulation() {
    let mut p = PauliString::from_str("X", 1).unwrap();
    
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::Y);
    assert_eq!(p.phase(), Phase::PlusI);
    
    apply_single_gate(&mut p, 0, SingleGate::S);
    assert_eq!(p.get_pauli(0), SinglePauli::X);
    assert_eq!(p.phase(), Phase::MinusI);
}

