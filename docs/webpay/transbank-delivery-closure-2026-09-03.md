# Webpay Plus: cierre de entrega de Transbank

Fecha: 2026-09-03

Estado: entrega cerrada; sin cambios técnicos pendientes por esta notificación

## Interpretación

Transbank envió una notificación titulada “Cierre de requerimiento” y una
encuesta sobre la entrega del producto Webpay Plus. Es una solicitud de opinión
posterior al cierre, no una instrucción para reinstalar o reconfigurar la
integración.

La integración de ReskiChile ya está desplegada con el SDK oficial de Node.js.
El par productivo vigente asociado al comercio `597053098160` autentica contra
Transbank y completó correctamente una compra controlada de CLP 50 y su reversa.

## Diferencia observada en el correo de bienvenida

El correo de bienvenida recibido el mismo día menciona el código
`597053098159`, diferente del código productivo vigente por su último dígito.
Ese correo no contiene una API Key Secret y la llave vigente no autentica el
código mencionado allí.

La comunicación se archiva como antecedente administrativo. No se programa una
migración ni se cambia ninguna variable productiva a partir de ella. Solo sería
necesario consultar a Transbank si ReskiChile quisiera operar específicamente
el código `597053098159` como una afiliación adicional.

## Estado operativo

- no cambiar `TRANSBANK_COMMERCE_CODE`;
- no reemplazar ni reutilizar `TRANSBANK_API_KEY_SECRET`;
- conservar el par productivo actual en el gestor de secretos;
- no se requiere responder la encuesta para que Webpay continúe funcionando;
- mantener como evidencia el smoke test productivo del 2026-09-02.
