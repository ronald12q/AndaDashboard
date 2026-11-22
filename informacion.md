
**Tu flujo sí tiene sentido: el ciudadano registra la solicitud, el administrador revisa lo necesario y después habilita el pago.** Lo que cambia entre los seis trámites es si hay que comprar una pieza o presentar documentos especiales.

La confusión viene de tu primera lista: mezcla **requisitos publicados por ANDA** con **campos y evidencias que tú propones para la web**. Las fotografías, por ejemplo, forman parte de tu propuesta de revisión digital; no debemos presentarlas como requisitos oficiales ya establecidos.

Yo dejaría el funcionamiento así:

**1. El ciudadano crea su cuenta una sola vez.**

Nombre, correo, DUI y contraseña. Después inicia sesión con DUI y contraseña, como habíamos planteado.

La cuenta permite guardar sus solicitudes. **Registrarse no demuestra automáticamente que sea propietario o titular del servicio.**

**2. Selecciona uno de los seis trámites y llena los datos del servicio.**

Para tu prototipo, estos serían los campos comunes:

- NIS de la cuenta.
- Dirección y referencias del inmueble.
- Teléfono de contacto.
- Motivo de la solicitud.
- Relación con el servicio: titular, propietario o representante.

El nombre y DUI pueden recuperarse de su perfil. El sistema genera un número de solicitud y queda **«En revisión»**.

**3. El administrador revisa la solicitud.**

En una implementación institucional, el empleado consulta manualmente el NIS en el sistema de ANDA y registra el resultado en tu portal. También revisa si el solicitante puede gestionar ese trámite y si falta información.

En tu proyecto académico, **esa consulta se representa con datos de prueba**, porque no tienes acceso al sistema de ANDA.

Si falta algo, cambia a **«Requiere corrección»**, escribe la observación y el ciudadano corrige la misma solicitud.

**4. Aquí se divide el flujo según el trámite.**

|Trámite|Qué se necesita además de los datos comunes|Qué ocurre antes de habilitar el pago|
|---|---|---|
|**Instalación de medidor**|Medidor compatible. En tu propuesta: fotografías y ficha técnica disponible.|Administrador indica las especificaciones; ciudadano compra y envía evidencia; administrador hace una revisión preliminar.|
|**Instalación de caja**|Caja proporcionada por el ciudadano. En tu propuesta: foto de la caja y del lugar.|Se indican las características aplicables y se revisa la evidencia.|
|**Instalación de válvula**|Válvula compatible. En tu propuesta: fotografías y ficha técnica disponible.|Se indican las especificaciones y se revisa la evidencia de la pieza comprada.|
|**Reconexión**|Revisar la causa de suspensión y, si fue por mora, su regularización.|Administrador comprueba la situación de la cuenta y determina el arancel correspondiente.|
|**Desconexión a solicitud**|Solicitud, identificación, escritura y carta justificativa, conforme al formulario institucional aplicable; representación si corresponde.|Administrador revisa la documentación, la situación de la cuenta y la modalidad solicitada.|
|**Detección de fuga interna**|Descripción del problema y datos para coordinar el acceso.|Se revisa la solicitud y se habilita el pago; la inspección previa ocurre en el inmueble.|

**No necesitas exigir escritura, factura de compra y copia del DUI en todos los trámites.** Cada formulario muestra únicamente lo que corresponde. El checklist de fugas puede servir como orientación, pero no sustituye la inspección técnica.

**5. Para medidor, caja y válvula, el ciudadano compra después de recibir las especificaciones.**

Ejemplo con el medidor:

1. Envía la solicitud con su NIS y datos del inmueble.
2. El administrador revisa la cuenta.
3. Envía las especificaciones de compra.
4. La solicitud queda **«Pendiente de material»**.
5. El ciudadano compra y sube las fotografías.
6. El administrador solicita una corrección o habilita el pago.

La aprobación de la fotografía significa **«la evidencia permite continuar»**. La compatibilidad y el estado de la pieza todavía deben comprobarse físicamente.

**6. El ciudadano paga el servicio y recibe el comprobante.**

En tu proyecto será un **pago simulado**, como establece tu documento. Después queda **«Pendiente de programación»** y el administrador registra la fecha tentativa de visita.

**7. Se realiza la visita y se registra el resultado.**

En tu propuesta, el ciudadano entrega la pieza al fontanero en el inmueble. El técnico la comprueba y realiza el trabajo. Si es incompatible, se registra la observación y la solicitud queda pendiente de resolver el material.

Hay un punto que debes dejar explícito en tu documento: **la respuesta de ANDA de septiembre de 2026 indica entrega del medidor y la válvula en agencia**. Entregarlos directamente al fontanero en el domicilio es el cambio operativo que propones y necesita validación institucional.

**8. El administrador cierra la solicitud.**

Registra fecha, resultado y observaciones. El ciudadano ve **«Finalizada»** en su historial. Pagar o programar una visita todavía no significa que el trabajo esté terminado.

Así, tu web administra **la solicitud, la revisión, el pago simulado y el seguimiento**. El chatbot acompaña al ciudadano durante esos pasos: explica requisitos y estados, mientras las aprobaciones las realiza el administrador.
