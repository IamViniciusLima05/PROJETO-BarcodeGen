/* Codificadores de código de barras escritos do zero: Code 128 (B/C automático), EAN-13, EAN-8 e UPC-A.
   Cada função devolve uma lista de módulos (1 = barra, 0 = espaço) e o texto legível. */

const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
const larguras = (p) => [...p].flatMap((w, i) => Array(+w).fill(i % 2 ? 0 : 1));

function code128(txt) {
  if (!txt) throw new Error('Digite um conteúdo');
  if ([...txt].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126)) throw new Error('Code 128 aceita só letras sem acento, números e símbolos comuns');
  // conjunto C (pares de dígitos) para sequências longas de números; B para o resto
  const vals = []; let i = 0, set = null;
  const run = (k) => { let n = 0; while (k + n < txt.length && /\d/.test(txt[k + n])) n++; return n; };
  while (i < txt.length) {
    const d = run(i), fim = i + d === txt.length;
    const valeC = set === 'C' ? d >= 2 : (i === 0 ? (d >= 4 && (fim || d >= 4)) : (fim ? d >= 4 : d >= 6));
    if (valeC) {
      if (d % 2 && set !== 'C') { // número ímpar de dígitos: o primeiro vai em B
        if (set !== 'B') { vals.push(set ? 100 : 104); set = 'B'; }
        vals.push(txt.charCodeAt(i) - 32); i++; continue;
      }
      if (set !== 'C') { vals.push(set ? 99 : 105); set = 'C'; }
      while (run(i) >= 2) { vals.push(+txt.substr(i, 2)); i += 2; }
    } else {
      if (set !== 'B') { vals.push(set ? 100 : 104); set = 'B'; }
      vals.push(txt.charCodeAt(i) - 32); i++;
    }
  }
  const soma = vals.reduce((s, v, k) => s + v * (k || 1), 0) % 103;
  const mods = [...vals, soma, 106].flatMap((v) => larguras(C128[v]));
  return { mods, texto: txt, guardas: null };
}

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARIDADE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function digitoEAN(semDV) { const s = [...semDV].reverse().reduce((t, d, k) => t + +d * (k % 2 ? 1 : 3), 0); return (10 - (s % 10)) % 10; }
function validarNum(txt, tam, nome) {
  const t = txt.replace(/\s/g, '');
  if (!/^\d+$/.test(t)) throw new Error(`${nome} aceita só números`);
  if (t.length === tam - 1) return t + digitoEAN(t);
  if (t.length === tam) { const dv = digitoEAN(t.slice(0, -1)); if (dv !== +t.at(-1)) throw new Error(`Dígito verificador errado: o último dígito deveria ser ${dv}`); return t; }
  throw new Error(`${nome} tem ${tam} dígitos (ou ${tam - 1} sem o verificador, que calculamos para você)`);
}
function ean13(txt) {
  const t = validarNum(txt, 13, 'EAN-13'), par = PARIDADE[+t[0]];
  const esq = [...t.slice(1, 7)].map((d, k) => (par[k] === 'L' ? L : G)[+d]).join(''), dir = [...t.slice(7)].map((d) => R[+d]).join('');
  const bits = '101' + esq + '01010' + dir + '101';
  return { mods: [...bits].map(Number), texto: t, guardas: [[0, 3], [45, 50], [92, 95]], tipo: 'ean13' };
}
function ean8(txt) {
  const t = validarNum(txt, 8, 'EAN-8');
  const bits = '101' + [...t.slice(0, 4)].map((d) => L[+d]).join('') + '01010' + [...t.slice(4)].map((d) => R[+d]).join('') + '101';
  return { mods: [...bits].map(Number), texto: t, guardas: [[0, 3], [31, 36], [64, 67]], tipo: 'ean8' };
}
function upca(txt) {
  const t = validarNum(txt, 12, 'UPC-A'), e = ean13('0' + t);
  return { ...e, texto: t, tipo: 'upca', guardas: [[0, 10], [45, 50], [85, 95]] };
}
const CODIFICADORES = { code128: code128, ean13: ean13, ean8: ean8, upca: upca };
