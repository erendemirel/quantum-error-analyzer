OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
h q[0];
s q[0];
sdg q[0];
x q[0];
y q[0];
z q[0];
cx q[0],q[1];
cz q[1],q[2];
swap q[0],q[2];

