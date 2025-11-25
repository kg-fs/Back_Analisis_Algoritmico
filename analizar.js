import express from 'express';
import cors from 'cors';
import { performance } from 'perf_hooks';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Lenguajes soportados
const LENGUAJES = ['js', 'typescript'];

// Entradas recomendadas según el tipo de algoritmo
const ENTRADAS_BASE = [1000, 5000, 10000, 50000, 100000];

app.post('/api/analizar', async (req, res) => {
  try {
    const { lenguaje, codigo, entradas } = req.body;

    if (!LENGUAJES.includes(lenguaje)) {
      return res.status(400).json({ error: 'Solo JS/TS soportado' });
    }

    // Si no vienen entradas, usamos default grandes
    const nValues = entradas && entradas.length ? entradas : ENTRADAS_BASE;

    const tiempos = [];
    const repeticiones = 5; // promedio para mayor precisión

    for (const n of nValues) {
      let suma = 0;

      for (let i = 0; i < repeticiones; i++) {
        try {
          // Reemplazamos {{n}} en el código
          const codigoFinal = codigo.replaceAll('{{n}}', n);

          // Medimos tiempo
          const inicio = performance.now();

          // Ejecutar con eval (solo JS/TS)
          eval(codigoFinal);

          const fin = performance.now();
          suma += fin - inicio;
        } catch (e) {
          console.error(`Error ejecutando código n=${n}:`, e.message);
          suma = -1;
          break;
        }
      }

      // Promediar
      tiempos.push(suma === -1 ? -1 : suma / repeticiones);
    }

    // Evitar ceros para ratios
    const tiemposValidos = tiempos.map(t => t <= 0 ? 0.00001 : t);

    // Calcular ratios
    const ratios = [];
    for (let i = 1; i < tiemposValidos.length; i++) {
      ratios.push(tiemposValidos[i] / tiemposValidos[i - 1]);
    }

    // Determinar Big-O
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);

    let bigO = 'O(?)';
    if (avgRatio < 1.5) bigO = 'O(1)';
    else if (avgRatio < 3) bigO = 'O(log n)';
    else if (avgRatio < 8) bigO = 'O(n)';
    else if (avgRatio < 40) bigO = 'O(n log n)';
    else bigO = 'O(n² o mayor)';

    res.json({
      tiempos: tiempos.map(t => t === -1 ? -1 : Number(t.toFixed(3))),
      ratios: ratios.map(r => Number(r.toFixed(2))),
      bigO,
      nValues
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor JS/TS listo en puerto ${PORT}`));
