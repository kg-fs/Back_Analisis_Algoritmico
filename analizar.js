import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// lenguajes que requieren reemplazar {{n}}
const LENGUAJES_PARAMETRICOS = ['js', 'typescript'];

// lenguajes que se entregan tal cual
const LENGUAJES_COMPILADOS = ['c', 'cpp', 'go', 'java', 'csharp'];

app.post('/api/analizar', async (req, res) => {
  try {
    const { lenguaje, codigo, entradas } = req.body;

    // validar
    if (!lenguaje || !codigo || !entradas) {
      return res.status(400).json({ error: 'Datos faltantes' });
    }

    const tiempos = [];

    for (const n of entradas) {
      let suma = 0;
      const repeticiones = 3;

      for (let i = 0; i < repeticiones; i++) {
        try {
          let codigoFinal = codigo;

          // si es JS o TS, insertamos n
          if (LENGUAJES_PARAMETRICOS.includes(lenguaje)) {
            codigoFinal = codigo.replaceAll('{{n}}', n);
          }

          // enviamos a Piston
          const respuesta = await axios.post(
            'https://emkc.org/api/v2/piston/execute',
            {
              language: lenguaje === 'typescript' ? 'ts' : lenguaje,
              version: '*',
              files: [
                {
                  name: 'main',
                  content: codigoFinal
                }
              ]
            }
          );

          // tiempo real que devuelve Piston
          suma += respuesta.data.run.time || 0;

        } catch (e) {
          console.error("Error:", e.response?.data || e.message);
          suma = -1;
          break;
        }
      }

      tiempos.push(suma === -1 ? -1 : suma / repeticiones);
    }

    // limpieza
    const tiemposValidos = tiempos.map(t => t <= 0 ? 0.00001 : t);

    // calcular ratios
    const ratios = [];
    for (let i = 1; i < tiemposValidos.length; i++) {
      ratios.push(tiemposValidos[i] / tiemposValidos[i - 1]);
    }

    // Big-O
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);

    let bigO = 'O(?)';
    if (avgRatio < 2) bigO = 'O(1)';
    else if (avgRatio < 5) bigO = 'O(log n)';
    else if (avgRatio < 20) bigO = 'O(n)';
    else if (avgRatio < 200) bigO = 'O(n log n)';
    else bigO = 'O(n² o mayor)';

    return res.json({
      tiempos,
      ratios: ratios.map(r => Number(r.toFixed(2))),
      bigO
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor listo en puerto ' + PORT));
