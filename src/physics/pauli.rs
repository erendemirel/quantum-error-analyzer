//! Pauli operator representation using bit-packed symplectic form.
//!
//! - x_bits: bit vector where bit i = 1 if X component on qubit i
//! - z_bits: bit vector where bit i = 1 if Z component on qubit i
//! - phase: overall phase factor(+1, -1, +i, -i)

use std::fmt;
use std::ops::{BitXor, BitXorAssign};
use serde::{Deserialize, Serialize};

/// Encoded as: 0 = +1, 1 = +i, 2 = -1, 3 = -i
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum Phase {
    PlusOne = 0,
    PlusI = 1,
    MinusOne = 2,
    MinusI = 3,
}

impl Phase {
    pub fn from_u8(value: u8) -> Self {
        match value & 3 {
            0 => Phase::PlusOne,
            1 => Phase::PlusI,
            2 => Phase::MinusOne,
            3 => Phase::MinusI,
            _ => unreachable!(),
        }
    }

    pub fn to_u8(self) -> u8 {
        self as u8
    }

    pub fn multiply(self, other: Phase) -> Phase {
        let result = ((self.to_u8() + other.to_u8()) % 4) as u8;
        Phase::from_u8(result)
    }

    pub fn negate(self) -> Phase {
        Phase::from_u8((self.to_u8() + 2) % 4)
    }
}

impl BitXor for Phase {
    type Output = Phase;

    fn bitxor(self, rhs: Phase) -> Self::Output {
        self.multiply(rhs)
    }
}

impl BitXorAssign for Phase {
    fn bitxor_assign(&mut self, rhs: Phase) {
        *self = self.multiply(rhs);
    }
}

impl fmt::Display for Phase {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Phase::PlusOne => write!(f, ""),
            Phase::PlusI => write!(f, "i"),
            Phase::MinusOne => write!(f, "−"),
            Phase::MinusI => write!(f, "−i"),
        }
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum SinglePauli {
    I,
    X,
    Y,
    Z,
}

impl fmt::Display for SinglePauli {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SinglePauli::I => write!(f, "I"),
            SinglePauli::X => write!(f, "X"),
            SinglePauli::Y => write!(f, "Y"),
            SinglePauli::Z => write!(f, "Z"),
        }
    }
}

/// Multi-qubit Pauli string using bit-packed symplectic representation.
///
/// For n qubits:
/// - x_bits: u64(supports up to 64 qubits, expandable with BitVec)
/// - z_bits: u64
/// - phase: Phase(2 bits)
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PauliString {
    /// X components: bit i = 1 means X on qubit i
    x_bits: u64,
    z_bits: u64,
    phase: Phase,
    /// For bounds checking
    num_qubits: usize,
}

impl PauliString {
    pub fn new(num_qubits: usize) -> Self {
        if num_qubits > 64 {
            panic!("PauliString currently supports up to 64 qubits");
        }
        Self {
            x_bits: 0,
            z_bits: 0,
            phase: Phase::PlusOne,
            num_qubits,
        }
    }

    /// Create from string representation (e.g., "X I Z" or "XIZ")
    pub fn from_str(s: &str, num_qubits: usize) -> Result<Self, String> {
        let mut x_bits = 0u64;
        let mut z_bits = 0u64;
        
        let chars: Vec<char> = s.chars().filter(|c| !c.is_whitespace()).collect();
        
        if chars.len() != num_qubits {
            return Err(format!(
                "String length {} doesn't match num_qubits {}",
                chars.len(),
                num_qubits
            ));
        }

        for (i, ch) in chars.iter().enumerate() {
            if i >= 64 {
                return Err("Too many qubits (max 64)".to_string());
            }
            
            match ch {
                'I' | 'i' => {}
                'X' | 'x' => {
                    x_bits |= 1 << i;
                }
                'Z' | 'z' => {
                    z_bits |= 1 << i;
                }
                'Y' | 'y' => {
                    x_bits |= 1 << i;
                    z_bits |= 1 << i;
                }
                _ => {
                    return Err(format!("Invalid Pauli character: {}", ch));
                }
            }
        }

        Ok(Self {
            x_bits,
            z_bits,
            phase: Phase::PlusOne,
            num_qubits,
        })
    }

    pub fn num_qubits(&self) -> usize {
        self.num_qubits
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    pub fn get_pauli(&self, qubit: usize) -> SinglePauli {
        if qubit >= self.num_qubits {
            panic!("Qubit index {} out of range (max {})", qubit, self.num_qubits);
        }
        
        let x = (self.x_bits >> qubit) & 1;
        let z = (self.z_bits >> qubit) & 1;
        
        match (x, z) {
            (0, 0) => SinglePauli::I,
            (1, 0) => SinglePauli::X,
            (0, 1) => SinglePauli::Z,
            (1, 1) => SinglePauli::Y,
            _ => unreachable!(),
        }
    }

    pub fn set_pauli(&mut self, qubit: usize, pauli: SinglePauli) {
        if qubit >= self.num_qubits {
            panic!("Qubit index {} out of range (max {})", qubit, self.num_qubits);
        }
        
        let mask = !(1u64 << qubit);
        self.x_bits &= mask;
        self.z_bits &= mask;
        
        match pauli {
            SinglePauli::I => {}
            SinglePauli::X => {
                self.x_bits |= 1 << qubit;
            }
            SinglePauli::Z => {
                self.z_bits |= 1 << qubit;
            }
            SinglePauli::Y => {
                self.x_bits |= 1 << qubit;
                self.z_bits |= 1 << qubit;
            }
        }
    }

    /// Multiply two Pauli strings: self * other
    ///
    /// This implements the Pauli multiplication rules:
    /// - X * Z = iY (with phase +i)
    /// - Z * X = -iY (with phase -i)
    /// - X * X = I
    /// - Z * Z = I
    /// - Y * Y = I
    /// - etc.
    pub fn multiply(&self, other: &Self) -> Self {
        if self.num_qubits != other.num_qubits {
            panic!("Cannot multiply Pauli strings with different qubit counts");
        }

        let new_x_bits = self.x_bits ^ other.x_bits;
        let new_z_bits = self.z_bits ^ other.z_bits;

        // Phase formula: phase = phase1 * phase2 * i^ω(P1, P2)
        // where ω(P1, P2) = Σ_i (x1_i * z2_i - z1_i * x2_i) mod 4
        let mut phase = self.phase.multiply(other.phase);
        
        let x1_and_z2 = self.x_bits & other.z_bits;
        let z1_and_x2 = self.z_bits & other.x_bits;
        
        let positive_contrib = x1_and_z2.count_ones() as i32;
        let negative_contrib = z1_and_x2.count_ones() as i32;
        let phase_exponent = ((positive_contrib - negative_contrib) % 4 + 4) % 4;
        
        if phase_exponent != 0 {
            let phase_factor = Phase::from_u8(phase_exponent as u8);
            phase = phase.multiply(phase_factor);
        }

        Self {
            x_bits: new_x_bits,
            z_bits: new_z_bits,
            phase,
            num_qubits: self.num_qubits,
        }
    }

    /// Check if two Pauli strings commute
    pub fn commutes_with(&self, other: &Self) -> bool {
        if self.num_qubits != other.num_qubits {
            return false;
        }
        
        let symplectic_product = (self.x_bits & other.z_bits) ^ (self.z_bits & other.x_bits);
        symplectic_product.count_ones() % 2 == 0
    }

    pub fn x_bits(&self) -> u64 {
        self.x_bits
    }

    pub fn z_bits(&self) -> u64 {
        self.z_bits
    }

    pub fn set_x_bits(&mut self, x_bits: u64) {
        self.x_bits = x_bits;
    }

    pub fn set_z_bits(&mut self, z_bits: u64) {
        self.z_bits = z_bits;
    }

    pub fn set_phase(&mut self, phase: Phase) {
        self.phase = phase;
    }
}

impl fmt::Display for PauliString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Display phase if not +1
        if self.phase != Phase::PlusOne {
            write!(f, "{}", self.phase)?;
        }
        
        for i in 0..self.num_qubits {
            write!(f, "{}", self.get_pauli(i))?;
            if i < self.num_qubits - 1 {
                write!(f, " ")?;
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pauli_string_creation() {
        let p = PauliString::new(3);
        assert_eq!(p.num_qubits(), 3);
        assert_eq!(p.get_pauli(0), SinglePauli::I);
        assert_eq!(p.get_pauli(1), SinglePauli::I);
        assert_eq!(p.get_pauli(2), SinglePauli::I);
    }

    #[test]
    fn test_pauli_string_from_str() {
        let p = PauliString::from_str("X I Z", 3).unwrap();
        assert_eq!(p.get_pauli(0), SinglePauli::X);
        assert_eq!(p.get_pauli(1), SinglePauli::I);
        assert_eq!(p.get_pauli(2), SinglePauli::Z);
    }

    #[test]
    fn test_pauli_multiplication_basic() {
        // X * I = X
        let x = PauliString::from_str("X", 1).unwrap();
        let i = PauliString::from_str("I", 1).unwrap();
        let result = x.multiply(&i);
        assert_eq!(result.get_pauli(0), SinglePauli::X);
        assert_eq!(result.phase(), Phase::PlusOne);
        
        // I * X = X
        let result = i.multiply(&x);
        assert_eq!(result.get_pauli(0), SinglePauli::X);
    }

    #[test]
    fn test_pauli_multiplication_x_z() {
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
    }

    #[test]
    fn test_pauli_multiplication_self() {
        // X * X = I
        let x = PauliString::from_str("X", 1).unwrap();
        let result = x.multiply(&x);
        assert_eq!(result.get_pauli(0), SinglePauli::I);
        
        // Z * Z = I
        let z = PauliString::from_str("Z", 1).unwrap();
        let result = z.multiply(&z);
        assert_eq!(result.get_pauli(0), SinglePauli::I);
        
        // Y * Y = I
        let y = PauliString::from_str("Y", 1).unwrap();
        let result = y.multiply(&y);
        assert_eq!(result.get_pauli(0), SinglePauli::I);
    }

    #[test]
    fn test_commutation() {
        // X and Z anti-commute
        let x = PauliString::from_str("X", 1).unwrap();
        let z = PauliString::from_str("Z", 1).unwrap();
        assert!(!x.commutes_with(&z));
        
        // X and X commute
        assert!(x.commutes_with(&x));
        
        // I commutes with everything
        let i = PauliString::from_str("I", 1).unwrap();
        assert!(i.commutes_with(&x));
        assert!(i.commutes_with(&z));
    }
}

