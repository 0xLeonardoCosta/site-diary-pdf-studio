/**
 * Turns the paper behind a scanned signature transparent and keeps the ink's own colour, so it
 * reads as pen on the page instead of a pasted white rectangle. The paper tone comes from the
 * image's median brightness, which tolerates grey scans and phone photos.
 * Returns the bounds of the ink so empty margins can be cropped.
 */
export function removerFundo(px: Uint8ClampedArray, largura: number, altura: number) {
  const brilho = (i: number) => 0.299 * (px[i] ?? 0) + 0.587 * (px[i + 1] ?? 0) + 0.114 * (px[i + 2] ?? 0);
  const histograma = new Array<number>(256).fill(0);
  for (let i = 0; i < px.length; i += 4) {
    const b = Math.round(brilho(i));
    histograma[b] = (histograma[b] ?? 0) + 1;
  }
  let acumulado = 0;
  let papel = 255;
  for (let b = 0; b < 256; b++) {
    acumulado += histograma[b] ?? 0;
    if (acumulado >= (largura * altura) / 2) { papel = b; break; }
  }
  // Soft edge instead of a hard cut, which is what gives scans their jagged "digital" outline.
  const inicio = papel - 18, faixa = 70;
  let x0 = largura, y0 = altura, x1 = -1, y1 = -1;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      const alfa = Math.max(0, Math.min(255, ((inicio - brilho(i)) / faixa) * 255));
      px[i + 3] = alfa;
      if (alfa > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 };
}

/** A hand never lands twice in the same spot; this varies per RDO but stays the same on every export of it. */
export function posicaoAssinatura(numero: number) {
  return { angulo: (((numero * 3) % 7) - 3) * 0.6, x: ((numero * 13) % 25) - 12, y: 2 + (numero % 5) };
}
