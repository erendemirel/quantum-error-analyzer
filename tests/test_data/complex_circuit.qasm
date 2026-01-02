OPENQASM 2.0;
include "qelib1.inc";
qreg q[4];
h q[0];
s q[1];
sdg q[2];
x q[3];
cx q[0],q[1];
cx q[2],q[3];
cz q[1],q[2];
swap q[0],q[3];

