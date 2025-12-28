//! Quantum error propagation simulator.
//!
//! This module implements the core simulation engine that tracks how
//! Pauli errors propagate through Clifford circuits.

use crate::physics::circuit::Circuit;
use crate::physics::pauli::PauliString;
use crate::physics::propagation::apply_gate;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Snapshot {
    pub time: usize,
    pub error_pattern: PauliString,
    pub gate_applied: Option<usize>,
}

pub struct Simulator {
    error_pattern: PauliString,
    circuit: Circuit,
    timeline: Vec<Snapshot>,
    current_time: usize,
}

impl Simulator {
    pub fn new(circuit: Circuit) -> Self {
        let num_qubits = circuit.num_qubits;
        let error_pattern = PauliString::new(num_qubits);
        
        let mut simulator = Self {
            error_pattern,
            circuit,
            timeline: Vec::new(),
            current_time: 0,
        };
        
        simulator.timeline.push(Snapshot {
            time: 0,
            error_pattern: simulator.error_pattern.clone(),
            gate_applied: None,
        });
        
        simulator
    }

    pub fn inject_error(&mut self, qubit: usize, pauli: crate::physics::pauli::SinglePauli) {
        self.error_pattern.set_pauli(qubit, pauli);
        if let Some(last) = self.timeline.last_mut() {
            last.error_pattern = self.error_pattern.clone();
        }
    }

    pub fn error_pattern(&self) -> &PauliString {
        &self.error_pattern
    }

    pub fn current_time(&self) -> usize {
        self.current_time
    }

    pub fn depth(&self) -> usize {
        self.circuit.depth()
    }

    pub fn step_forward(&mut self) -> bool {
        if self.current_time >= self.circuit.gates.len() {
            return false;
        }

        let gate = &self.circuit.gates[self.current_time];
        apply_gate(&mut self.error_pattern, gate);
        
        self.current_time += 1;
        
        self.timeline.push(Snapshot {
            time: self.current_time,
            error_pattern: self.error_pattern.clone(),
            gate_applied: Some(self.current_time - 1),
        });
        
        true
    }

    pub fn step_backward(&mut self) -> bool {
        if self.current_time == 0 {
            return false;
        }

        self.timeline.pop();
        self.current_time -= 1;
        
        if let Some(prev_snapshot) = self.timeline.last() {
            self.error_pattern = prev_snapshot.error_pattern.clone();
        }
        
        true
    }

    pub fn reset(&mut self) {
        self.current_time = 0;
        self.error_pattern = PauliString::new(self.circuit.num_qubits);
        self.timeline.clear();
        self.timeline.push(Snapshot {
            time: 0,
            error_pattern: self.error_pattern.clone(),
            gate_applied: None,
        });
    }

    pub fn run(&mut self) {
        while self.step_forward() {}
    }

    pub fn get_snapshot(&self, time: usize) -> Option<&Snapshot> {
        if time < self.timeline.len() {
            Some(&self.timeline[time])
        } else {
            None
        }
    }

    pub fn timeline(&self) -> &[Snapshot] {
        &self.timeline
    }

    pub fn circuit(&self) -> &Circuit {
        &self.circuit
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};
    use crate::physics::pauli::SinglePauli;

    #[test]
    fn test_simulator_basic() {
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
        
        assert!(sim.step_forward());
        // H X H' = Z
        assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
        
        assert!(sim.step_forward());
        assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
        assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::I);
    }

    #[test]
    fn test_cnot_x_propagation() {
        let mut circuit = Circuit::new(2);
        circuit
            .add_gate(Gate::Two(TwoGate::CNOT {
                control: 0,
                target: 1,
            }))
            .unwrap();

        let mut sim = Simulator::new(circuit);
        sim.inject_error(0, SinglePauli::X);
        sim.run();
        assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::X);
        assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::X);
    }

    #[test]
    fn test_cnot_z_propagation() {
        let mut circuit = Circuit::new(2);
        circuit
            .add_gate(Gate::Two(TwoGate::CNOT {
                control: 0,
                target: 1,
            }))
            .unwrap();

        let mut sim = Simulator::new(circuit);
        sim.inject_error(1, SinglePauli::Z);
        sim.run();
        assert_eq!(sim.error_pattern().get_pauli(0), SinglePauli::Z);
        assert_eq!(sim.error_pattern().get_pauli(1), SinglePauli::Z);
    }
}

