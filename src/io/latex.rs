use crate::physics::circuit::{Circuit, Gate, SingleGate, TwoGate};

pub fn export_latex(circuit: &Circuit) -> String {
    let mut latex = String::from("\\documentclass{article}\n");
    latex.push_str("\\usepackage{qcircuit}\n");
    latex.push_str("\\begin{document}\n");
    latex.push_str("\\begin{equation*}\n");
    latex.push_str("\\Qcircuit @C=1em @R=.7em {\n");

    // Group gates by time step(assuming sequential gates for now)
    // TODO: A more sophisticated version(e.g. analyze gate dependencies)
    let mut gates_by_time: Vec<Vec<&Gate>> = Vec::new();
    for gate in &circuit.gates {
        gates_by_time.push(vec![gate]);
    }

    for qubit in 0..circuit.num_qubits {
        let mut line = String::new();
        
        for (time, gates_at_time) in gates_by_time.iter().enumerate() {
            let gate_on_qubit: Option<&Gate> = gates_at_time
                .iter()
                .find(|g| g.qubits().contains(&qubit))
                .copied();

            if let Some(gate) = gate_on_qubit {
                match gate {
                    Gate::Single { qubit: q, gate } if *q == qubit => {
                        line.push_str(&format_single_gate_latex(*gate));
                    }
                    Gate::Two(two_gate) => {
                        match two_gate {
                            TwoGate::CNOT { control, target } => {
                                if *control == qubit {
                                    line.push_str("\\ctrl{");
                                    let target_idx = if *target > qubit {
                                        *target - qubit
                                    } else {
                                        qubit - *target
                                    };
                                    line.push_str(&target_idx.to_string());
                                    line.push('}');
                                } else if *target == qubit {
                                    line.push_str("\\targ");
                                } else {
                                    line.push_str("\\qw");
                                }
                            }
                            TwoGate::CZ { control, target } => {
                                if *control == qubit {
                                    line.push_str("\\control");
                                } else if *target == qubit {
                                    line.push_str("\\controlo");
                                } else {
                                    line.push_str("\\qw");
                                }
                            }
                            TwoGate::SWAP { qubit1, qubit2 } => {
                                if (*qubit1 == qubit && *qubit2 != qubit) || (*qubit2 == qubit && *qubit1 != qubit) {
                                    line.push_str("\\qswap");
                                } else {
                                    line.push_str("\\qw");
                                }
                            }
                        }
                    }
                    _ => {
                        line.push_str("\\qw");
                    }
                }
            } else {
                line.push_str("\\qw");
            }
            
            if time < gates_by_time.len() - 1 {
                line.push_str(" & ");
            }
        }
        
        latex.push_str(&line);
        latex.push_str(" \\\\\n");
    }

    latex.push_str("}\n");
    latex.push_str("\\end{equation*}\n");
    latex.push_str("\\end{document}\n");

    latex
}

fn format_single_gate_latex(gate: SingleGate) -> String {
    match gate {
        SingleGate::H => "\\gate{H}".to_string(),
        SingleGate::S => "\\gate{S}".to_string(),
        SingleGate::Sdg => "\\gate{S^\\dagger}".to_string(),
        SingleGate::X => "\\gate{X}".to_string(),
        SingleGate::Y => "\\gate{Y}".to_string(),
        SingleGate::Z => "\\gate{Z}".to_string(),
        SingleGate::I => "\\qw".to_string(),
    }
}

/// Export a circuit to LaTeX format using a simpler tikz based representation
/// This is a more readable format that doesn't require qcircuit
pub fn export_latex_simple(circuit: &Circuit) -> String {
    let mut latex = String::from("\\documentclass{article}\n");
    latex.push_str("\\usepackage{tikz}\n");
    latex.push_str("\\begin{document}\n");
    latex.push_str(&format!("Circuit with {} qubits and {} gates:\n\n", circuit.num_qubits, circuit.gates.len()));
    latex.push_str("\\begin{verbatim}\n");
    
    for (i, gate) in circuit.gates.iter().enumerate() {
        latex.push_str(&format!("Gate {}: {}\n", i, gate));
    }
    
    latex.push_str("\\end{verbatim}\n");
    latex.push_str("\\end{document}\n");
    latex
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latex_export() {
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

        let latex = export_latex(&circuit);
        assert!(latex.contains("qcircuit"));
        assert!(latex.contains("\\gate{H}"));
    }
}

