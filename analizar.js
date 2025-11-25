// Endpoint de análisis con medición precisa
app.post('/api/analizar', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'No se recibieron datos' });

    const { lenguaje, codigo, entradas } = req.body;
    if (!lenguaje || !codigo || !entradas) return res.status(400).json({ error: 'Faltan datos' });

    const LENGUAJES = ['js', 'c', 'cpp', 'java', 'csharp', 'go', 'typescript'];
    if (!LENGUAJES.includes(lenguaje)) return res.status(400).json({ error: 'Lenguaje no soportado' });

    const tiempos = [];

    for (const n of entradas) {
      let suma = 0;
      const repeticiones = 10; // puedes ajustar según conveniencia

      for (let r = 0; r < repeticiones; r++) {
        try {
          const start = process.hrtime.bigint();

          await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: lenguaje === 'typescript' ? 'ts' : lenguaje,
            version: '*',
            files: [{ name: 'main', content: `
              function algoritmo(n) {
                ${codigo}
              }
              algoritmo(${n});
            `}],
            stdin: ''
          });

          const end = process.hrtime.bigint();
          suma += Number(end - start) / 1_000_000; // ms con decimales
        } catch (e) {
          console.error(`Error Piston (${lenguaje}) n=${n}:`, e.message);
          suma = -1;
          break; // si falla, no sigue repitiendo
        }
      }

      tiempos.push(suma === -1 ? -1 : suma / repeticiones);
    }

    // Calcular ratios
    const ratios = [];
    const tiemposValidos = tiempos.map(t => (t <= 0 ? 0.0001 : t)); // evitar división por 0
    for (let i = 1; i < tiemposValidos.length; i++) {
      ratios.push(tiemposValidos[i] / tiemposValidos[i-1]);
    }

    // Estimación Big O
    const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    let bigO = 'O(?)';
    if (avgRatio < 3) bigO = 'O(1)';
    else if (avgRatio < 15) bigO = 'O(log n)';
    else if (avgRatio < 150) bigO = 'O(n)';
    else if (avgRatio < 1500) bigO = 'O(n log n)';
    else bigO = 'O(n² o mayor)';

    res.status(200).json({
      tiempos: tiempos.map(t => t < 0 ? -1 : t.toFixed(3)),
      bigO,
      ratios: ratios.map(r => r.toFixed(2))
    });

  } catch (err) {
    console.error('Error general:', err);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
  }
});
