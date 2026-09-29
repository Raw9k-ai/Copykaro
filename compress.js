// Compress a PDF in the browser: render each page to a JPEG and rebuild the PDF.
// Libraries load only when compression is used, so the rest of the site stays fast.
export async function compressPdf(file, { scale = 1.5, quality = 0.6, onProgress } = {}) {
  const [pdfjs, worker, pdfLib] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    import('pdf-lib'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const out = await pdfLib.PDFDocument.create()

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(i, pdf.numPages)
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const view = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(view.width)
    canvas.height = Math.floor(view.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: view }).promise

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    const p = out.addPage([base.width, base.height])
    p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })

    canvas.width = 0
    canvas.height = 0
    page.cleanup()
  }

  const bytes = await out.save()
  const result = new File([bytes], file.name, { type: 'application/pdf' })
  // Keep whichever is smaller
  return result.size < file.size ? result : file
}
