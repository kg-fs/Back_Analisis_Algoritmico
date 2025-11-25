import express from 'express';
import cors from 'cors';
import { performance } from 'perf_hooks';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ENTRADAS = [1000, 4000, 10000, 20000, 50000, 100000];

app.post('/api/analizar', async (req, res) => {
  let funcionUsuario;
  try {
    const { codigo } = req.body;

    // Extraer la función del código enviado
    // Soporta: function algo(n) => function algoritmo(n)
    const match = codigo.match(/function\s+\w+\s*\(\s*n\s*\)\s*{[\s\S]*}/);
    if (!match) {
      return res.status(400).json({ error: "No se encontró una función con parámetro 'n'" });
    }

    const funcionTexto = match[0];

    // Crear la función real (sin eval global peligroso)
    const codigoEjecutable = `
      ${codigo}
      return ${funcionTexto.split('function')[1].split('(')[0].trim()};
    `;

    funcionUsuario = new Function('n', `
      "use strict";
      ${codigo}
      const func = ${funcionTexto};
      return func(n);
    `);

    // Test rápido
    funcionUsuario(1);

  } catch (err) {
    return res.status(400).json({ error: "Código inválido o función no ejecutable: " + err.message });
  }

  const tiempos = [];
  const nValues = ENTRADAS;
  const repeticiones = 7;

  for (const n of nValues) {
    let total = 0;
    let ejecucionesValidas = 0;

    for (let r = 0; r < repeticiones; r++) {
      try {
        const inicio = performance.now();
        funcionUsuario(n); // ¡Aquí sí se ejecuta!
        const fin = performance.now();
        const duracion = fin - inicio;

        if (duracion > 0.05) { // filtrar ruido extremo
          total += duracion;
          ejecucionesValidas++;
        }
      } catch (e) {
        console.error("Error en ejecución:", e);
      }
    }

    const promedio = ejecucionesValidas > 0 ? total / ejecucionesValidas : 0.001;
    tiempos.push(promedio);
  }

  // === REGRESIÓN LOG-LOG PARA BIG O (MÉTODO CIENTÍFICO) ===
  const puntos = tiempos
    .map((t, i) => ({ n: nValues[i], t: t < 0.1 ? 0.1 : t })) // evitar log(0)
    .filter(p => p.t > 0.1); // solo tiempos medibles

  if (puntos.length < 3) {
    return res.json({
      tiempos: tiempos.map(t => Number(t.toFixed(3))),
      nValues,
      bigO: "O(?) - Muy rápido o error",
      nota: "Tiempos muy bajos para medir"
    });
  }

  const logN = puntos.map(p => Math.log(p.n));
  const logT = puntos.map(p => Math.log(p.t));

  // Regresión lineal simple: logT = a * logN + b → T = k * n^a
  const nLog = logN.length;
  const sumX = logN.reduce((a, b) => a + b, 0);
  const sumY = logT.reduce((a, b) => a + b, 0);
  const sumXY = logN.reduce((a, b, i) => a + b * logT[i], 0);
  const sumX2 = logN.reduce((a, b) => a + b * b, 0);

  const pendiente = (nLog * sumXY - sumX * sumY) / (nLog * sumX2 - sumX * sumX);
  const ordenada = (sumY - pendiente * sumX) / nLog;

  const exponente = Number(pendiente.toFixed(2));
  let bigO = "O(?)";

  if (exponente < 0.15) bigO = "O(1)";
  else if (exponente < 0.6) bigO = "O(log n)";
  else if (exponente < 1.3) bigO = "O(n)";
  else if (exponente < 1.8) bigO = "O(n log n)";
  else if (exponente < 2.4) bigO = "O(n²)";
  else bigO = "O(n³ o mayor)";

  // Calcular R² para confianza
  const predicciones = logN.map(x => pendiente * x + ordenada);
  const mediaY = sumY / nLog;
  const ssTot = logT.reduce((sum, y) => sum + (y - mediaY) ** 2, 0);
  const ssRes = logT.reduce((sum, y, i) => sum + (y - predicciones[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  res.json({
    tiempos: tiempos.map(t => Number(t.toFixed(3))),
    nValues,
    bigO,
    exponente,
    confianza: r2 > 0.9 ? "Alta" : r2 > 0.7 ? "Media" : "Baja",
    nota: r2 < 0.7 ? "Resultado poco fiable (ruido o comportamiento irregular)" : "Análisis confiable"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend Big O PRO listo en puerto ${PORT}`));