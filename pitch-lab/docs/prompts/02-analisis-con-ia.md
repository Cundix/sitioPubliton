# Prompt 2 — Análisis real del audio con IA (2026-11-13)

Mensaje recibido de la persona usuaria, **transcripto tal como se recibió** (era un mensaje de voz transcripto,
por eso conserva su forma oral):

> hacé que Bueno, me gusta, está muy bien hecho, pero ahora lo que necesito es que el programa no solo detecte, o sea,
> que haga un análisis comprensivo real del audio y no que sea solo un text-to-speech y que tome las boletillas, ¿no?
> Es decir, yo quiero que analice la idea, que analice el tono, que analice, si se puede, una cámara que analice las
> gesticulaciones de las manos, aunque ya sé que eso es medio complicado. Lo ideal sería usar una API. No sé de dónde
> podría sacar una API. O sea, digo, tengo Gemini Plus, tipo en el estudio que me da unas APIs, pero no sé si esas APIs
> que me dan son suficientes, porque pensá que yo necesito probar esto y debería hacer 50 jugadas en un día, más o
> menos. Si se nos queda sin créditos la API sería un problema. Entonces, bueno, pero que entienda el contexto, ¿no? Y
> que te dé antes, que te dé máximo 5 minutos para prepararlo. Y de esos 5 minutos, que bueno, que vos puedas... No,
> mentira. Descarta lo de 5 minutos. Está bien así de que cada uno maneja su tiempo. Descarta lo de 5 minutos. Y bueno,
> eso. Make no mistakes, please.

Mensaje posterior, durante el trabajo (la **clave de API** que la persona pegó en el mensaje se **omite** acá a
propósito: no debe quedar en el repositorio):

> Gemini 3.5 Flash Lite Estaba viendo, podemos usar Gemini 3.5 Flashlight para el manejo, tipo la API y todo eso. Que
> tiene un RPM de 15 y 250.000 de TPM. *[clave de API omitida]*

## Cómo se interpretó

| Pedido | Qué se hizo |
|---|---|
| Análisis comprensivo del audio: idea, tono | Gemini analiza el **audio** frente al brief; devuelve rúbrica de contenido con citas y observaciones de entrega (sin emociones) |
| Cámara para las manos «si se puede» | Detector de manos en el dispositivo (MediaPipe); solo cifras, sin video |
| «Lo ideal sería usar una API» | API de Gemini con **la clave de cada persona** (el sitio es estático: no hay dónde guardar una clave compartida) |
| 50 jugadas por día / créditos | Se investigó la cuota: la suscripción de consumo **no** da cuota de API; la capa gratuita alcanza por minuto y tokens; el tope diario hay que mirarlo en AI Studio; hay modelo de respaldo. Ver [`../analisis-con-ia.md`](../analisis-con-ia.md) |
| «Que entienda el contexto» | El pedido incluye el brief (marca, problema, público, objetivo, restricción, guía), el escenario y la duración |
| Usar Gemini 3.5 Flash-Lite | Modelo principal `gemini-3.5-flash-lite` |
| «Descartá lo de 5 minutos» | **No se agregó** ningún tope de 5 minutos: la preparación sigue ajustable de 0 a 300 s |
| «Make no mistakes» | Se escribieron pruebas de unidad y de navegador real; se corrigieron fallos encontrados (ver `../problemas-resueltos.md`, 9–13); y se declara por separado lo verificado y lo no verificado |

## Nota sobre la clave pegada en el chat

Esa clave quedó en el historial de la conversación. Se usó **solo desde la computadora de trabajo** para verificar
el acceso a la API y un análisis de prueba, nunca se escribió en el repositorio ni en los registros, y el archivo
temporal donde se guardó se borró al terminar. **Conviene revocarla** (AI Studio → API keys → eliminar) y crear otra
para las pruebas del equipo.
