import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Endpoint de análisis
app.post('/api/analizar', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'No se recibieron datos' });

    const { lenguaje, codigo, entradas } = req.body;

    if (!lenguaje || !codigo || !entradas) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    // Lenguajes soportados
    const LENGUAJES = ['js', 'c', 'cpp', 'java', 'csharp', 'go', 'typescript'];
    if (!LENGUAJES.includes(lenguaje)) {
      return res.status(400).json({ error: 'Lenguaje no soportado' });
    }

    const tiempos = [];

    // Ejecutar el código para cada valor de entrada
    for (const n of entradas) {
      let suma = 0;
      const repeticiones = 5; // Ajustable: mientras más repeticiones, más preciso

      for (let r = 0; r < repeticiones; r++) {
        try {
          const start = process.hrtime.bigint();

          await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: lenguaje === 'typescript' ? 'ts' : lenguaje,
            version: '*',
            files: [{
              name: 'main',
              content: `
                function algoritmo(n) {
                  ${codigo}
                }
                algoritmo(${n});
              `
            }],
            stdin: ''
          });

          const end = process.hrtime.bigint();
          suma += Number(end - start) / 1_000_000; // convertir a ms
        } catch (e) {
          console.error(`Error ejecutando Piston (${lenguaje}) n=${n}:`, e.message);
          suma = -1;
          break; // No repetir si falló
        }
      }

      tiempos.push(suma === -1 ? -1 : suma / repeticiones);
    }

    // Calcular ratios
    const tiemposValidos = tiempos.map(t => t <= 0 ? 0.0001 : t);
    const ratios = [];

    for (let i = 1; i < tiemposValidos.length; i++) {
      ratios.push(tiemposValidos[i] / tiemposValidos[i - 1]);
    }

    // Determinar Big-O
    const avgRatio = ratios.length
      ? ratios.reduce((a, b) => a + b, 0) / ratios.length
      : 0;

    let bigO = 'O(?)';
    if (avgRatio < 3) bigO = 'O(1)';
    else if (avgRatio < 15) bigO = 'O(log n)';
    else if (avgRatio < 150) bigO = 'O(n)';
    else if (avgRatio < 1500) bigO = 'O(n log n)';
    else bigO = 'O(n² o mayor)';

    // Respuesta final
    res.status(200).json({
      tiempos: tiempos.map(t => t === -1 ? -1 : Number(t.toFixed(3))),
      ratios: ratios.map(r => Number(r.toFixed(2))),
      bigO
    });

  } catch (err) {
    console.error('Error general:', err);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: err.message
    });
  }
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
