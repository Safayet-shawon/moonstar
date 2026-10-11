/** Small dense-matrix toolkit used by the load, power-factor and pricing engines. */
export type Matrix = number[][];
export type Vector = number[];

export function shape(a: Matrix): [number, number] {
  return [a.length, a[0]?.length ?? 0];
}

export function transpose(a: Matrix): Matrix {
  const [r, c] = shape(a);
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i][j]));
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  const [ar, ac] = shape(a);
  const [br, bc] = shape(b);
  if (ac !== br) throw new Error(`Dimension mismatch: ${ar}x${ac} · ${br}x${bc}`);
  const out: Matrix = Array.from({ length: ar }, () => new Array(bc).fill(0));
  for (let i = 0; i < ar; i++)
    for (let k = 0; k < ac; k++) {
      const aik = a[i][k];
      for (let j = 0; j < bc; j++) out[i][j] += aik * b[k][j];
    }
  return out;
}

export function matVec(a: Matrix, v: Vector): Vector {
  return matMul(a, v.map((x) => [x])).map((r) => r[0]);
}

export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Exact dot product for BigInt vectors (money). */
export function dotBig(a: bigint[], b: bigint[]): bigint {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  let s = 0n;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function hadamard(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  return a.map((x, i) => x * b[i]);
}

export function colSums(a: Matrix): Vector {
  const [, c] = shape(a);
  return Array.from({ length: c }, (_, j) => a.reduce((s, row) => s + row[j], 0));
}

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

export function diag(v: Vector): Matrix {
  return v.map((x, i) => v.map((_, j) => (i === j ? x : 0)));
}

/** Solve A x = b with Gaussian elimination + partial pivoting. */
export function solve(a: Matrix, b: Vector): Vector {
  const n = a.length;
  const m = a.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) throw new Error("Singular matrix");
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = m[i][n];
    for (let j = i + 1; j < n; j++) s -= m[i][j] * x[j];
    x[i] = s / m[i][i];
  }
  return x;
}
