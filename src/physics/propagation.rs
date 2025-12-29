//! Gate conjugation rules for Pauli error propagation.
//!
//! This module implements the physics of how Pauli operators transform
//! under Clifford gates via conjugation: P -> U P U'

use crate::physics::pauli::{PauliString, Phase};
use crate::physics::circuit::{Gate, SingleGate, TwoGate};

pub fn apply_single_gate(pauli: &mut PauliString, qubit: usize, gate: SingleGate) {
    if qubit >= pauli.num_qubits() {
        panic!("Qubit index {} out of range", qubit);
    }

    match gate {
        SingleGate::I => {}
        SingleGate::X => {
            if pauli.z_bits()[qubit] {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        SingleGate::Y => {
            let x_bit = pauli.x_bits()[qubit];
            let z_bit = pauli.z_bits()[qubit];
            
            // Y X Y' = -X, Y Z Y' = -Z
            if x_bit && !z_bit {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            } else if !x_bit && z_bit {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        SingleGate::Z => {
            if pauli.x_bits()[qubit] {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        SingleGate::H => {
            let x_bit = pauli.x_bits()[qubit];
            let z_bit = pauli.z_bits()[qubit];
            
            let mut new_x = pauli.x_bits().clone();
            let mut new_z = pauli.z_bits().clone();
            new_x.set(qubit, z_bit);
            new_z.set(qubit, x_bit);
            pauli.set_x_bits(new_x);
            pauli.set_z_bits(new_z);
            
            if x_bit && z_bit {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        SingleGate::S => {
            let x_bit = pauli.x_bits()[qubit];
            let z_bit = pauli.z_bits()[qubit];
            
            if x_bit {
                let mut new_z = pauli.z_bits().clone();
                let old_value = new_z[qubit];
                new_z.set(qubit, !old_value);
                pauli.set_z_bits(new_z);
                
                if !z_bit {
                    pauli.set_phase(pauli.phase().multiply(Phase::PlusI));
                } else {
                    let current_phase = pauli.phase();
                    if current_phase == Phase::MinusI {
                        pauli.set_phase(Phase::PlusOne);
                    } else {
                        pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
                    }
                }
            }
        }
        SingleGate::Sdg => {
            let x_bit = pauli.x_bits()[qubit];
            let z_bit = pauli.z_bits()[qubit];
            
            if x_bit {
                let mut new_z = pauli.z_bits().clone();
                let old_value = new_z[qubit];
                new_z.set(qubit, !old_value);
                pauli.set_z_bits(new_z);
                
                if !z_bit {
                    pauli.set_phase(pauli.phase().multiply(Phase::MinusI));
                } else {
                    let current_phase = pauli.phase();
                    if current_phase == Phase::PlusI {
                        pauli.set_phase(Phase::PlusOne);
                    }
                }
            }
        }
    }
}

pub fn apply_two_gate(pauli: &mut PauliString, gate: TwoGate) {
    match gate {
        TwoGate::CNOT { control, target } => {
            if control >= pauli.num_qubits() || target >= pauli.num_qubits() {
                panic!("Qubit index out of range");
            }
            if control == target {
                panic!("CNOT control and target must be different");
            }
            
            let x_c = pauli.x_bits()[control];
            let z_t = pauli.z_bits()[target];
            
            // X on control spreads to target, Z on target spreads to control
            if x_c {
                let mut new_x = pauli.x_bits().clone();
                new_x.set(target, true);
                pauli.set_x_bits(new_x);
            }
            let mut new_z = pauli.z_bits().clone();
            if z_t {
                let old_value = new_z[control];
                new_z.set(control, !old_value);
            }
            pauli.set_z_bits(new_z);
            
            if x_c && z_t {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        TwoGate::CZ { control, target } => {
            if control >= pauli.num_qubits() || target >= pauli.num_qubits() {
                panic!("Qubit index out of range");
            }
            if control == target {
                panic!("CZ control and target must be different");
            }
            
            let x_c = pauli.x_bits()[control];
            let x_t = pauli.x_bits()[target];
            
            let mut new_z = pauli.z_bits().clone();
            if x_c {
                let old_value = new_z[target];
                new_z.set(target, !old_value);
            }
            if x_t {
                let old_value = new_z[control];
                new_z.set(control, !old_value);
            }
            pauli.set_z_bits(new_z);
            
            if x_c && x_t {
                pauli.set_phase(pauli.phase().multiply(Phase::MinusOne));
            }
        }
        TwoGate::SWAP { qubit1, qubit2 } => {
            if qubit1 >= pauli.num_qubits() || qubit2 >= pauli.num_qubits() {
                panic!("Qubit index out of range");
            }
            if qubit1 == qubit2 {
                return;
            }
            
            let x1 = pauli.x_bits()[qubit1];
            let z1 = pauli.z_bits()[qubit1];
            let x2 = pauli.x_bits()[qubit2];
            let z2 = pauli.z_bits()[qubit2];
            
            let mut new_x = pauli.x_bits().clone();
            let mut new_z = pauli.z_bits().clone();
            new_x.set(qubit1, x2);
            new_x.set(qubit2, x1);
            new_z.set(qubit1, z2);
            new_z.set(qubit2, z1);
            
            pauli.set_x_bits(new_x);
            pauli.set_z_bits(new_z);
        }
    }
}

pub fn apply_gate(pauli: &mut PauliString, gate: &Gate) {
    match gate {
        Gate::Single { qubit, gate } => {
            apply_single_gate(pauli, *qubit, *gate);
        }
        Gate::Two(two_gate) => {
            apply_two_gate(pauli, *two_gate);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::physics::pauli::{PauliString, SinglePauli};

    #[test]
    fn test_hadamard_conjugation() {
        let mut p = PauliString::from_str("X", 1).unwrap();
        apply_single_gate(&mut p, 0, SingleGate::H);
        assert_eq!(p.get_pauli(0), SinglePauli::Z);
        assert_eq!(p.phase(), Phase::PlusOne);
        
        let mut p = PauliString::from_str("Z", 1).unwrap();
        apply_single_gate(&mut p, 0, SingleGate::H);
        assert_eq!(p.get_pauli(0), SinglePauli::X);
        
        let mut p = PauliString::from_str("Y", 1).unwrap();
        apply_single_gate(&mut p, 0, SingleGate::H);
        assert_eq!(p.get_pauli(0), SinglePauli::Y);
        assert_eq!(p.phase(), Phase::MinusOne);
    }

    #[test]
    fn test_phase_gate_conjugation() {
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
    }

    #[test]
    fn test_cnot_propagation() {
        let mut p = PauliString::from_str("X I", 2).unwrap();
        apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
        assert_eq!(p.get_pauli(0), SinglePauli::X);
        assert_eq!(p.get_pauli(1), SinglePauli::X);
        
        let mut p = PauliString::from_str("I Z", 2).unwrap();
        apply_two_gate(&mut p, TwoGate::CNOT { control: 0, target: 1 });
        assert_eq!(p.get_pauli(0), SinglePauli::Z);
        assert_eq!(p.get_pauli(1), SinglePauli::Z);
    }
}

