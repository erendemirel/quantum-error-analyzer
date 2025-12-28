use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SingleGate {
    X,
    Y,
    Z,
    H,
    S,
    Sdg,
    I,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TwoGate {
    CNOT { control: usize, target: usize },
    CZ { control: usize, target: usize },
    SWAP { qubit1: usize, qubit2: usize },
}

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Gate {
    Single {
        qubit: usize,
        gate: SingleGate,
    },
    Two(TwoGate),
}

impl Gate {
    pub fn qubits(&self) -> Vec<usize> {
        match self {
            Gate::Single { qubit, .. } => vec![*qubit],
            Gate::Two(two_gate) => match two_gate {
                TwoGate::CNOT { control, target } | TwoGate::CZ { control, target } => {
                    vec![*control, *target]
                }
                TwoGate::SWAP { qubit1, qubit2 } => vec![*qubit1, *qubit2],
            },
        }
    }
}

impl fmt::Display for Gate {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Gate::Single { qubit, gate } => write!(f, "{:?}({})", gate, qubit),
            Gate::Two(TwoGate::CNOT { control, target }) => {
                write!(f, "CNOT({}, {})", control, target)
            }
            Gate::Two(TwoGate::CZ { control, target }) => {
                write!(f, "CZ({}, {})", control, target)
            }
            Gate::Two(TwoGate::SWAP { qubit1, qubit2 }) => {
                write!(f, "SWAP({}, {})", qubit1, qubit2)
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Circuit {
    pub num_qubits: usize,
    pub gates: Vec<Gate>,
}

impl Circuit {
    pub fn new(num_qubits: usize) -> Self {
        Self {
            num_qubits,
            gates: Vec::new(),
        }
    }

    pub fn add_gate(&mut self, gate: Gate) -> Result<(), String> {
        for qubit in gate.qubits() {
            if qubit >= self.num_qubits {
                return Err(format!(
                    "Gate acts on qubit {} but circuit has only {} qubits",
                    qubit, self.num_qubits
                ));
            }
        }
        self.gates.push(gate);
        Ok(())
    }

    pub fn gates_at_time(&self, time: usize) -> Vec<&Gate> {
        if time < self.gates.len() {
            vec![&self.gates[time]]
        } else {
            vec![]
        }
    }

    pub fn depth(&self) -> usize {
        self.gates.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_creation() {
        let circuit = Circuit::new(3);
        assert_eq!(circuit.num_qubits, 3);
        assert_eq!(circuit.gates.len(), 0);
    }

    #[test]
    fn test_add_gate() {
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
        assert_eq!(circuit.gates.len(), 2);
    }

    #[test]
    fn test_invalid_qubit_index() {
        let mut circuit = Circuit::new(2);
        let result = circuit.add_gate(Gate::Single {
            qubit: 5,
            gate: SingleGate::H,
        });
        assert!(result.is_err());
    }
}

