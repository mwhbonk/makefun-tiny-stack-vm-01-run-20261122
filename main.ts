// tiny-stack-vm-01-run-20261122: a faithful VM for make.fun's tiny stack ISA.
// One program answers all 40 instances: for each /input/<id>/ it runs
// program.bin on input.bin and writes /output/<id>/stdout.bin + exit.txt.
// Node 22, standard library only, no network, no clock, deterministic.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const STEP_LIMIT = 1000000;
const OUTPUT_MAX = 65536;

// Run one program on its input bytes. Returns [stdout bytes, exit code].
// The exit code is 0 on HALT, v & 255 on EXIT, or the trap code (2-11).
function run(program, input) {
  const n = program.length;
  const S = new Int32Array(256); // data stack
  let sp = 0;
  const C = new Int32Array(64); // call stack of return addresses
  let csp = 0;
  const M = new Int32Array(256); // memory, all zero at start
  const out = new Uint8Array(OUTPUT_MAX);
  let olen = 0;
  let inPos = 0;
  let pc = 0;
  let steps = 0;
  const finish = (code) => [out.subarray(0, olen), code];
  for (;;) {
    // Per-step checks, in ISA order: step limit, pc range, known opcode,
    // immediate fits, then the stack needs of the instruction.
    if (steps === STEP_LIMIT) return finish(10);
    if (pc < 0 || pc >= n) return finish(9);
    const op = program[pc];
    let imm = 0;
    let pops = 0;
    let pushes = 0;
    switch (op) {
      case 0x01: imm = 1; pushes = 1; break; // PUSH8
      case 0x02: imm = 4; pushes = 1; break; // PUSH32
      case 0x03: case 0x50: case 0x51: case 0x53: pops = 1; break; // POP, PRINT, PUTC, EXIT
      case 0x04: pops = 1; pushes = 2; break; // DUP
      case 0x05: pops = 2; pushes = 2; break; // SWAP
      case 0x06: pops = 2; pushes = 3; break; // OVER
      case 0x07: pops = 3; pushes = 3; break; // ROT
      case 0x17: case 0x1b: case 0x40: pops = 1; pushes = 1; break; // NEG, NOT, LOAD
      case 0x31: case 0x32: pops = 1; break; // JZ, JNZ
      case 0x41: pops = 2; break; // STORE
      case 0x52: pushes = 1; break; // IN
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: pops = 2; pushes = 1; break; // binary ops
      case 0x00: case 0x30: case 0x33: case 0x34: break; // HALT, JMP, CALL, RET
      default: return finish(5); // unknown opcode
    }
    if (op >= 0x30 && op <= 0x33) imm = 2; // JMP, JZ, JNZ, CALL
    if (pc + imm >= n) return finish(9); // immediate cut off by end
    steps++;
    const next = pc + 1 + imm;
    if (sp < pops) return finish(2);
    if (sp - pops + pushes > 256) return finish(3);
    pc = next;
    switch (op) {
      case 0x00: return finish(0); // HALT
      case 0x01: S[sp++] = (program[next - 1] << 24) >> 24; break; // sign-extend
      case 0x02: // little-endian 32-bit, signed by the top byte's shift
        S[sp++] = program[next - 4] | (program[next - 3] << 8) | (program[next - 2] << 16) | (program[next - 1] << 24);
        break;
      case 0x03: sp--; break; // POP
      case 0x04: S[sp] = S[sp - 1]; sp++; break; // DUP
      case 0x05: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; } // SWAP
      case 0x06: S[sp] = S[sp - 2]; sp++; break; // OVER
      case 0x07: { const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; break; } // ROT
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = S[sp - 1];
        const a = S[sp - 2];
        let r;
        switch (op) {
          case 0x10: r = (a + b) | 0; break; // ADD wraps
          case 0x11: r = (a - b) | 0; break; // SUB wraps
          case 0x12: r = Math.imul(a, b); break; // MUL low 32 bits
          case 0x13: // DIV truncates toward zero; INT_MIN / -1 stays INT_MIN
            if (b === 0) return finish(4);
            r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
            break;
          case 0x14: // MOD takes the sign of a; x % -1 is 0
            if (b === 0) return finish(4);
            r = b === -1 ? 0 : (a % b) | 0;
            break;
          case 0x15: // DIVU reads both operands unsigned
            if (b === 0) return finish(4);
            r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
            break;
          case 0x16: // MODU unsigned remainder, read back signed
            if (b === 0) return finish(4);
            r = ((a >>> 0) % (b >>> 0)) | 0;
            break;
          case 0x18: r = a & b; break;
          case 0x19: r = a | b; break;
          case 0x1a: r = a ^ b; break;
          case 0x1c: r = a << (b & 31); break; // only low 5 shift bits count
          case 0x1d: r = a >> (b & 31); break; // arithmetic shift
          case 0x1e: r = (a >>> (b & 31)) | 0; break; // logical shift
          case 0x20: r = a === b ? 1 : 0; break;
          case 0x21: r = a < b ? 1 : 0; break;
          case 0x22: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break; // LTU unsigned
        }
        sp -= 2;
        S[sp++] = r;
        break;
      }
      case 0x17: S[sp - 1] = (-S[sp - 1]) | 0; break; // NEG wraps INT_MIN
      case 0x1b: S[sp - 1] = ~S[sp - 1]; break; // NOT
      case 0x30: case 0x31: case 0x32: { // JMP, JZ, JNZ: signed 16-bit rel
        const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (op !== 0x30) {
          const v = S[--sp];
          take = op === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = next + rel;
        break;
      }
      case 0x33: // CALL: unsigned 16-bit absolute target
        if (csp === 64) return finish(7);
        C[csp++] = next;
        pc = program[next - 2] | (program[next - 1] << 8);
        break;
      case 0x34: // RET
        if (csp === 0) return finish(8);
        pc = C[--csp];
        break;
      case 0x40: { // LOAD: address must be 0..255
        const addr = S[sp - 1];
        if (addr < 0 || addr >= 256) return finish(6);
        S[sp - 1] = M[addr];
        break;
      }
      case 0x41: { // STORE pops value then address; top of stack is the address
        const addr = S[sp - 1];
        const v = S[sp - 2];
        if (addr < 0 || addr >= 256) return finish(6);
        sp -= 2;
        M[addr] = v;
        break;
      }
      case 0x50: { // PRINT: decimal ASCII; limit checked before writing
        const v = S[sp - 1];
        let u = v < 0 ? -v : v; // -INT_MIN is 2147483648, exact as a double
        let digits = 1;
        for (let t = u; t >= 10; t = (t / 10) | 0) digits++;
        const len = digits + (v < 0 ? 1 : 0);
        if (olen + len > OUTPUT_MAX) return finish(11);
        sp--;
        let p = olen + len;
        let t = u;
        while (t >= 10) { out[--p] = 48 + (t % 10); t = (t / 10) | 0; }
        out[--p] = 48 + t;
        if (v < 0) out[--p] = 45; // '-'
        olen += len;
        break;
      }
      case 0x51: // PUTC: one byte, v & 255; limit checked first
        if (olen + 1 > OUTPUT_MAX) return finish(11);
        out[olen++] = S[--sp] & 255;
        break;
      case 0x52: // IN: next input byte, or -1 once input is used up
        S[sp++] = inPos < input.length ? input[inPos++] : -1;
        break;
      case 0x53: return finish(S[--sp] & 255); // EXIT takes the low byte
    }
  }
}

// Driver: every instance directory, sorted, gets its answer files.
for (const id of readdirSync(IN_DIR).sort()) {
  const [stdout, code] = run(
    readFileSync(join(IN_DIR, id, 'program.bin')),
    readFileSync(join(IN_DIR, id, 'input.bin')),
  );
  mkdirSync(join(OUT_DIR, id), { recursive: true });
  writeFileSync(join(OUT_DIR, id, 'stdout.bin'), stdout);
  writeFileSync(join(OUT_DIR, id, 'exit.txt'), `${code}\n`);
}
