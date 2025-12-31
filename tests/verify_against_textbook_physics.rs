//! Tests that explicitly verify our implementation against known quantum mechanics
//! identities from textbooks and literature.
//!
//! These tests are designed to catch if our implementation deviates from standard
//! quantum mechanics, NOT to match our implementation's behavior.

use quantum_error_analyzer::physics::pauli::{PauliString, Phase, SinglePauli};
use quantum_error_analyzer::physics::circuit::{SingleGate, TwoGate};
use quantum_error_analyzer::physics::propagation::{apply_single_gate, apply_two_gate};

/// Verify CNOT gate conjugation rules from Nielsen & Chuang and standard QEC literature.
/// 
/// Standard rule: CNOT · (X_c ⊗ I_t) · CNOT' = X_c ⊗ X_t
/// This means X on control spreads to target.
#[test]
fn test_cnot_x_control_textbook_rule() {
    // From Nielsen & Chuang, Chapter 4: X on control spreads to target
    let mut p = PauliString::from_str("X I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    
    // Textbook expectation: X⊗I → X⊗X
    assert_eq!(p.get_pauli(0), SinglePauli::X, "X on control should stay X");
    assert_eq!(p.get_pauli(1), SinglePauli::X, "X on control should spread to target (textbook rule)");
    assert_eq!(p.phase(), Phase::PlusOne, "No phase change for X⊗I → X⊗X");
}

/// Verify CNOT gate: Z on target spreads to control.
/// 
/// Standard rule: CNOT · (I_c ⊗ Z_t) · CNOT' = Z_c ⊗ Z_t
#[test]
fn test_cnot_z_target_textbook_rule() {
    // From Nielsen & Chuang: Z on target spreads to control
    let mut p = PauliString::from_str("I Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    
    // Textbook expectation: I⊗Z → Z⊗Z
    assert_eq!(p.get_pauli(0), SinglePauli::Z, "Z on target should spread to control (textbook rule)");
    assert_eq!(p.get_pauli(1), SinglePauli::Z, "Z on target should stay Z");
    assert_eq!(p.phase(), Phase::PlusOne, "No phase change for I⊗Z → Z⊗Z");
}

/// Verify Hadamard gate: H · X · H' = Z (standard textbook identity).
#[test]
fn test_hadamard_x_to_z_textbook_rule() {
    // From any quantum computing textbook: H · X · H' = Z
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    
    // Textbook expectation: X → Z
    assert_eq!(p.get_pauli(0), SinglePauli::Z, "H should transform X to Z (textbook identity)");
    assert_eq!(p.phase(), Phase::PlusOne, "H·X·H' = Z has no phase");
}

/// Verify Hadamard gate: H · Z · H' = X (standard textbook identity).
#[test]
fn test_hadamard_z_to_x_textbook_rule() {
    // From any quantum computing textbook: H · Z · H' = X
    let mut p = PauliString::from_str("Z", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    
    // Textbook expectation: Z → X
    assert_eq!(p.get_pauli(0), SinglePauli::X, "H should transform Z to X (textbook identity)");
    assert_eq!(p.phase(), Phase::PlusOne, "H·Z·H' = X has no phase");
}

/// Verify Hadamard gate: H · Y · H' = -Y (standard textbook identity).
#[test]
fn test_hadamard_y_to_minus_y_textbook_rule() {
    // From any quantum computing textbook: H · Y · H' = -Y
    let mut p = PauliString::from_str("Y", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    
    // Textbook expectation: Y → Y with phase -1
    assert_eq!(p.get_pauli(0), SinglePauli::Y, "H should keep Y as Y");
    assert_eq!(p.phase(), Phase::MinusOne, "H·Y·H' = -Y (textbook identity with phase -1)");
}

/// Verify Phase gate: S · X · S' = iY (standard textbook identity).
#[test]
fn test_phase_gate_x_to_iy_textbook_rule() {
    // From any quantum computing textbook: S · X · S' = iY
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    
    // Textbook expectation: X → Y with phase +i
    assert_eq!(p.get_pauli(0), SinglePauli::Y, "S should transform X to Y");
    assert_eq!(p.phase(), Phase::PlusI, "S·X·S' = iY (textbook identity with phase +i)");
}

/// Verify CZ gate: CZ · (X ⊗ I) · CZ' = X ⊗ Z (standard textbook rule).
#[test]
fn test_cz_x_control_textbook_rule() {
    // From quantum error correction literature: CZ · (X_c ⊗ I_t) · CZ' = X_c ⊗ Z_t
    let mut p = PauliString::from_str("X I", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CZ { control: 0, target: 1 });
    
    // Textbook expectation: X⊗I → X⊗Z
    assert_eq!(p.get_pauli(0), SinglePauli::X, "X on control should stay X");
    assert_eq!(p.get_pauli(1), SinglePauli::Z, "X on control should spread Z to target (textbook rule)");
    assert_eq!(p.phase(), Phase::PlusOne, "No phase change for X⊗I → X⊗Z");
}

/// Verify Pauli multiplication: X · Z = iY (standard quantum mechanics).
#[test]
fn test_pauli_multiplication_xz_equals_iy_textbook() {
    // From quantum mechanics: X · Z = iY (this is fundamental)
    let x = PauliString::from_str("X", 1).unwrap();
    let z = PauliString::from_str("Z", 1).unwrap();
    let result = x.multiply(&z);
    
    // Textbook expectation: X · Z = iY
    assert_eq!(result.get_pauli(0), SinglePauli::Y, "X · Z should equal Y");
    assert_eq!(result.phase(), Phase::PlusI, "X · Z = iY (fundamental quantum mechanics)");
}

/// Verify Pauli multiplication: Z · X = -iY (standard quantum mechanics).
#[test]
fn test_pauli_multiplication_zx_equals_minus_iy_textbook() {
    // From quantum mechanics: Z · X = -iY (anti-commutation)
    let x = PauliString::from_str("X", 1).unwrap();
    let z = PauliString::from_str("Z", 1).unwrap();
    let result = z.multiply(&x);
    
    // Textbook expectation: Z · X = -iY
    assert_eq!(result.get_pauli(0), SinglePauli::Y, "Z · X should equal Y");
    assert_eq!(result.phase(), Phase::MinusI, "Z · X = -iY (fundamental quantum mechanics)");
}

/// Verify that H^2 = I (Hadamard is its own inverse).
#[test]
fn test_hadamard_squared_equals_identity_textbook() {
    // From any quantum computing textbook: H^2 = I
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::H);
    apply_single_gate(&mut p, 0, SingleGate::H);
    
    // Textbook expectation: H^2 · X · (H^2)' = H^2 · X · H^2 = I · X · I = X
    assert_eq!(p.get_pauli(0), SinglePauli::X, "H^2 should be identity (textbook rule)");
    assert_eq!(p.phase(), Phase::PlusOne, "H^2 = I has no phase");
}

/// Verify that S · S† = I (phase gate and its dagger are inverses).
#[test]
fn test_phase_gate_inverse_textbook() {
    // From any quantum computing textbook: S · S† = I
    let mut p = PauliString::from_str("X", 1).unwrap();
    apply_single_gate(&mut p, 0, SingleGate::S);
    apply_single_gate(&mut p, 0, SingleGate::Sdg);
    
    // Textbook expectation: S · S† · X · (S · S†)' = I · X · I = X
    assert_eq!(p.get_pauli(0), SinglePauli::X, "S · S† should be identity (textbook rule)");
    assert_eq!(p.phase(), Phase::PlusOne, "S · S† = I has no phase");
}

/// Verify CNOT with XZ error: CNOT · (X ⊗ Z) · CNOT' = -Y ⊗ Y (textbook rule).
#[test]
fn test_cnot_xz_to_minus_yy_textbook() {
    // From quantum error correction literature: CNOT · (X ⊗ Z) · CNOT' = -Y ⊗ Y
    let mut p = PauliString::from_str("X Z", 2).unwrap();
    apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
    
    // Textbook expectation: X⊗Z → Y⊗Y with phase -1
    assert_eq!(p.get_pauli(0), SinglePauli::Y, "CNOT · (X⊗Z) should give Y on control");
    assert_eq!(p.get_pauli(1), SinglePauli::Y, "CNOT · (X⊗Z) should give Y on target");
    assert_eq!(p.phase(), Phase::MinusOne, "CNOT · (X⊗Z) · CNOT' = -Y⊗Y (textbook rule)");
}

