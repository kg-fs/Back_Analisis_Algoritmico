
import express from 'express';
import cors from 'cors';
import { VM } from 'vm2';
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
    if (!lenguaje || !codigo || !entradas) return res.status(400).json({ error: 'Faltan datos' });

    const LENGUAJES = ['js', 'c', 'cpp', 'java', 'csharp'];
    if (!LENGUAJES.includes(lenguaje)) return res.status(400).json({ error: 'Lenguaje no soportado' });

    const tiempos = [];

    if (lenguaje === 'js') {
      const vm = new VM({ timeout: 5000, sandbox: { console } });
      for (const n of entradas) {
        const start = Date.now();
        try {
          vm.run(`function algoritmo(n){ ${codigo} } algoritmo(${n});`);
          tiempos.push(Date.now() - start);
        } catch {
          tiempos.push(-1);
        }
      }
    } else {
      // Para C, C++, Java y C#
      for (const n of entradas) {
        const start = Date.now();
        try {
          const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: lenguaje,
            version: '*',
            files: [{ name: 'main', content: codigo }],
            stdin: `${n}`
          });
          console.log(response.data); // Para depuración
          tiempos.push(Date.now() - start);
        } catch (e) {
          console.error('Error Piston:', e.message);
          tiempos.push(-1);
        }
      }
    }

    // Cálculo de ratios y big O
    const tiemposValidos = tiempos.filter(t => t > 0);
    const ratios = [];
    for (let i = 1; i < tiemposValidos.length; i++) {
      ratios.push(tiemposValidos[i-1] === 0 ? 1 : tiemposValidos[i] / tiemposValidos[i-1]);
    }
    const avgRatio = ratios.length ? ratios.reduce((a,b) => a+b,0)/ratios.length : 0;

    let bigO = 'O(?)';
    if (avgRatio < 3) bigO = 'O(1)';
    else if (avgRatio < 15) bigO = 'O(log n)';
    else if (avgRatio < 150) bigO = 'O(n)';
    else if (avgRatio < 1500) bigO = 'O(n log n)';
    else bigO = 'O(n² o mayor)';

    res.status(200).json({ tiempos, bigO, ratios: ratios.map(r => r.toFixed(2)) });

  } catch (err) {
    console.error('Error general:', err);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
  }
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

