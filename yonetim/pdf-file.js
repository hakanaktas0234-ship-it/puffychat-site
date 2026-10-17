(() => {
  'use strict';
  // Raster PDF keeps Turkish characters without third-party fonts or network calls.
  async function create(lines, identity) {
    const encoder = new TextEncoder();
    const chunks = [], offsets = [0]; let length = 0;
    const put = data => { const bytes = typeof data === 'string' ? encoder.encode(data) : data; chunks.push(bytes); length += bytes.length; };
    const object = (id, body) => { offsets[id] = length; put(`${id} 0 obj\n${body}\nendobj\n`); };
    const pages = [];
    let canvas, context, y;
    function nextPage() {
      canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
      context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1240, 1754);
      context.fillStyle = '#151515'; context.font = '24px Arial';
      context.fillText('PUFFY · BAYİ HESAP EKSTRESİ', 70, 65);
      context.font = '18px Arial'; context.fillText(identity, 70, 100); y = 155;
    }
    async function finishPage() {
      context.fillStyle = '#555555'; context.font = '17px Arial';
      context.fillText(`Sayfa ${pages.length + 1} · Hesap bilgilendirmesi; fatura değildir.`, 70, 1695);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
      if (!blob) throw new Error('PDF sayfası oluşturulamadı.');
      pages.push(new Uint8Array(await blob.arrayBuffer())); canvas.width = canvas.height = 1;
    }
    nextPage();
    for (const raw of lines) {
      // Wrap even a single long reference; never cut off its ending.
      let text = String(raw).replace(/[\r\n]+/g, ' ');
      if (!text) { y += 16; continue; }
      while (text.length) {
        if (y > 1620) { await finishPage(); nextPage(); }
        context.font = '21px Arial';
        let count = text.length;
        while (count > 1 && context.measureText(text.slice(0, count)).width > 1100) count--;
        context.fillStyle = '#151515'; context.font = '21px Arial';
        context.fillText(text.slice(0, count), 70, y); y += 33; text = text.slice(count);
      }
    }
    await finishPage();
    put('%PDF-1.4\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    pages.forEach((jpeg, i) => {
      const id = 3 + i * 3;
      object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Image ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
      offsets[id + 1] = length;
      put(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      put(jpeg); put('\nendstream\nendobj\n');
      const draw = 'q 595.28 0 0 841.89 0 0 cm /Image Do Q\n';
      object(id + 2, `<< /Length ${encoder.encode(draw).length} >>\nstream\n${draw}endstream`);
    });
    const count = 3 + pages.length * 3, xref = length;
    put(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let id = 1; id < count; id++) put(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
    put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  window.PuffyStatementPdf = { create };
})();
