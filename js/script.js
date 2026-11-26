/* BarcodeGen — desenha o código em SVG, exporta PNG/SVG e monta etiquetas para imprimir */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const banco = {
  ler(k, padrao) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } }
};
const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EXEMPLOS = { code128: 'PATRIMONIO-2026-0042', ean13: '789123456789', ean8: '9638507', upca: '03600029145' };
const DICAS = { code128: 'Letras sem acento, números e símbolos.', ean13: '12 dígitos (o 13º é calculado) ou 13 para conferir.', ean8: '7 dígitos (o 8º é calculado) ou 8 para conferir.', upca: '11 dígitos (o 12º é calculado) ou 12 para conferir.' };
let modo = 'um', ultimoSvg = '';
const valores = banco.ler('bc_valores', { ...EXEMPLOS });

function opcoes() { return { altura: +$('#altura').value, mod: +$('#modulo').value, margem: +$('#margem').value, cor: $('#cor').value, fundo: $('#fundo').value, texto: $('#texto-on').checked }; }

/* ---------- SVG ---------- */
// barras viram retângulos juntando módulos vizinhos; nos códigos EAN/UPC as guardas descem mais
function gerarSvg(cod, o) {
  const m = o.mod, mq = o.margem * m / 2 + 10 * m, fonte = 11 * m + 2;
  const ehProd = !!cod.guardas, extraGuarda = ehProd && o.texto ? fonte * 0.6 : 0;
  const altTexto = o.texto ? fonte + 4 : 0;
  // zona de silêncio: EAN pede ao menos 11 módulos à esquerda (onde fica o 1º dígito)
  const esq = ehProd ? Math.max(mq, 12 * m) : mq;
  const W = esq + cod.mods.length * m + mq, H = o.margem * 2 + o.altura + (ehProd ? extraGuarda : 0) + (ehProd ? 0 : altTexto);
  let rects = '', i = 0;
  const naGuarda = (k) => cod.guardas?.some(([a, b]) => k >= a && k < b);
  while (i < cod.mods.length) {
    if (!cod.mods[i]) { i++; continue; }
    let j = i; while (j < cod.mods.length && cod.mods[j]) j++;
    const h = o.altura + (naGuarda(i) ? extraGuarda : 0);
    rects += `<rect x="${esq + i * m}" y="${o.margem}" width="${(j - i) * m}" height="${h}"/>`;
    i = j;
  }
  let txt = '';
  if (o.texto) {
    const y = o.margem + o.altura + fonte * 0.95, estilo = `font-family="'Space Mono', 'Courier New', monospace" font-size="${fonte}"`;
    if (!ehProd) txt = `<text x="${W / 2}" y="${y}" text-anchor="middle" ${estilo}>${escapar(cod.texto)}</text>`;
    else {
      const t = cod.texto, meio = (a, b) => esq + ((a + b) / 2) * m;
      if (cod.tipo === 'ean13') txt = `<text x="${esq - 3 * m}" y="${y}" text-anchor="end" ${estilo}>${t[0]}</text><text x="${meio(3, 45)}" y="${y}" text-anchor="middle" letter-spacing="${m * 1.2}" ${estilo}>${t.slice(1, 7)}</text><text x="${meio(50, 92)}" y="${y}" text-anchor="middle" letter-spacing="${m * 1.2}" ${estilo}>${t.slice(7)}</text>`;
      else if (cod.tipo === 'ean8') txt = `<text x="${meio(3, 31)}" y="${y}" text-anchor="middle" letter-spacing="${m * 1.2}" ${estilo}>${t.slice(0, 4)}</text><text x="${meio(36, 64)}" y="${y}" text-anchor="middle" letter-spacing="${m * 1.2}" ${estilo}>${t.slice(4)}</text>`;
      else txt = `<text x="${esq - 3 * m}" y="${y}" text-anchor="end" font-size="${fonte * 0.75}" font-family="'Space Mono', monospace">${t[0]}</text><text x="${meio(10, 45)}" y="${y}" text-anchor="middle" letter-spacing="${m}" ${estilo}>${t.slice(1, 6)}</text><text x="${meio(50, 85)}" y="${y}" text-anchor="middle" letter-spacing="${m}" ${estilo}>${t.slice(6, 11)}</text><text x="${esq + 96 * m}" y="${y}" font-size="${fonte * 0.75}" font-family="'Space Mono', monospace">${t[11]}</text>`;
    }
  }
  const Hf = ehProd ? H + (o.texto ? fonte * 0.5 : 0) : H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(Hf)}" viewBox="0 0 ${W} ${Math.round(Hf)}" role="img" aria-label="Código de barras ${escapar(cod.texto)}"><rect width="100%" height="100%" fill="${o.fundo}"/><g fill="${o.cor}">${rects}${txt}</g></svg>`;
}

/* ---------- Render ---------- */
function render() {
  const tipo = $('#tipo').value, o = opcoes();
  $('#dica').textContent = DICAS[tipo]; $('#dica').className = '';
  banco.salvar('bc_opcoes', { tipo, ...o, modo });
  if (modo === 'um') {
    valores[tipo] = $('#conteudo').value; banco.salvar('bc_valores', valores);
    try {
      const cod = CODIFICADORES[tipo]($('#conteudo').value.trim());
      ultimoSvg = gerarSvg(cod, o); $('#previa').innerHTML = ultimoSvg; $('#erro').hidden = true;
      if (tipo !== 'code128' && cod.texto !== $('#conteudo').value.trim()) { $('#dica').textContent = `✓ Dígito verificador calculado: ${cod.texto.at(-1)} → ${cod.texto}`; $('#dica').className = 'ok'; }
      $$('#acoes-um button').forEach((b) => { b.disabled = false; });
      contraste(o);
    } catch (e) { $('#erro').textContent = e.message; $('#erro').hidden = false; $$('#acoes-um button').forEach((b) => { b.disabled = true; }); $('#previa').innerHTML = ''; ultimoSvg = ''; }
  } else {
    const linhas = $('#lote').value.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 120);
    banco.salvar('bc_lote', $('#lote').value);
    let ok = 0;
    const etqs = linhas.map((l) => { try { const s = gerarSvg(CODIFICADORES[tipo](l), o); ok++; return `<div class="etq">${s}</div>`; } catch (e) { return `<div class="etq erro">${escapar(l)}<br>${escapar(e.message)}</div>`; } });
    $('#previa').innerHTML = etqs.join('') || '<p>Cole os códigos, um por linha.</p>';
    $('#etiquetas').innerHTML = etqs.filter((x) => !x.includes('etq erro')).join('');
    $('#lote-info').textContent = `${ok} de ${linhas.length} válidos${linhas.length === 120 ? ' (máximo 120)' : ''}`;
    $('#imprimir').disabled = !ok; $('#erro').hidden = true;
    const cols = $('#colunas').value; $('#previa').style.setProperty('--cols', cols); $('#etiquetas').style.setProperty('--cols', cols);
  }
}
function contraste(o) {
  const lum = (h) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const a = lum(o.cor), b = lum(o.fundo), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (r < 4 || a > b) { $('#erro').textContent = a > b ? '⚠️ Barras mais claras que o fundo: muitos leitores não conseguem ler.' : '⚠️ Pouco contraste entre barras e fundo: o leitor pode falhar.'; $('#erro').hidden = false; }
}

/* ---------- Exportar ---------- */
const nomeArq = () => `codigo-${$('#tipo').value}-${$('#conteudo').value.trim().replace(/[^\w-]+/g, '_').slice(0, 40)}`;
function baixar(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function paraCanvas(escala = 3) {
  return new Promise((ok, erro) => {
    const img = new Image(), url = URL.createObjectURL(new Blob([ultimoSvg], { type: 'image/svg+xml' }));
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.width * escala; c.height = img.height * escala; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c); };
    img.onerror = erro; img.src = url;
  });
}
$('#svg').addEventListener('click', () => baixar(new Blob([ultimoSvg], { type: 'image/svg+xml' }), nomeArq() + '.svg'));
$('#png').addEventListener('click', async () => { const c = await paraCanvas(); c.toBlob((b) => baixar(b, nomeArq() + '.png')); });
$('#copiar').addEventListener('click', async () => {
  try { const c = await paraCanvas(); const b = await new Promise((r) => c.toBlob(r)); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('Imagem copiada!'); }
  catch { toast('Seu navegador não deixou copiar a imagem — use o download'); }
});
$('#imprimir').addEventListener('click', () => print());

/* ---------- Eventos ---------- */
$('#tipo').addEventListener('change', () => { $('#conteudo').value = valores[$('#tipo').value] ?? EXEMPLOS[$('#tipo').value]; render(); });
['#conteudo', '#lote', '#altura', '#modulo', '#margem', '#cor', '#fundo', '#texto-on', '#colunas'].forEach((s) => $(s).addEventListener('input', render));
$$('[data-modo]').forEach((b) => b.addEventListener('click', () => {
  modo = b.dataset.modo; $$('[data-modo]').forEach((x) => x.setAttribute('aria-selected', x === b));
  $('#campo-um').hidden = modo !== 'um'; $('#campo-lote').hidden = modo !== 'lote'; $('#acoes-um').hidden = modo !== 'um'; $('#acoes-lote').hidden = modo !== 'lote';
  $('#previa').classList.toggle('lote', modo === 'lote');
  if (modo === 'lote' && !$('#lote').value.trim()) $('#lote').value = $('#tipo').value === 'code128' ? 'CX-0001\nCX-0002\nCX-0003\nCX-0004\nCX-0005\nCX-0006' : '789123456789\n789123456790\n789123456791\n789123456792\n789123456793\n789123456794';
  render();
}));
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400); }

const op = banco.ler('bc_opcoes', null);
if (op) { $('#tipo').value = op.tipo; $('#altura').value = op.altura; $('#modulo').value = op.mod; $('#margem').value = op.margem; $('#cor').value = op.cor; $('#fundo').value = op.fundo; $('#texto-on').checked = op.texto; }
$('#lote').value = banco.ler('bc_lote', '');
$('#conteudo').value = valores[$('#tipo').value] ?? EXEMPLOS[$('#tipo').value];
render();
