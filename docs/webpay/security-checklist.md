# Checklist de seguridad para e-commerce y Webpay Plus

Estado: gate obligatorio de salida
Última revisión: 2026-08-18

Ninguna integración puede prometer ser “a prueba de hackeos”. El objetivo
realista es reducir superficie, impedir fallas conocidas, detectar abuso,
contener incidentes y recuperar el servicio sin perder la verdad financiera.

Prioridades:

- P0: bloquea pagos productivos.
- P1: obligatorio antes de apertura pública.
- P2: endurecimiento continuo con responsable y fecha.

## 1. Plataforma y continuidad

- [ ] P0 Vercel Production usa un plan autorizado para comercio; Hobby no.
- [ ] P0 Supabase Production usa al menos Pro y no el proyecto inestable Free.
- [ ] P0 antes de producción se cierra la revisión de continuidad diferida.
- [ ] P0 métricas de CPU, memoria, I/O, conexiones, storage y latencia revisadas.
- [ ] P0 consultas lentas y planes de ejecución críticos revisados.
- [ ] P0 índices de FK, checkout, jobs y columnas usadas por RLS revisados.
- [ ] P0 no se agregan conexiones SQL directas sin diseñar pooling serverless.
- [ ] P0 backups automáticos habilitados y retención documentada.
- [ ] P0 copia lógica cifrada fuera del proyecto automatizada.
- [ ] P0 restauración probada en un entorno aislado; RPO/RTO registrados.
- [ ] P1 spend caps, límites y alertas de consumo configurados.
- [ ] P1 runbook de caída de Supabase, Vercel, Transbank y correo.
- [ ] P1 PAYMENTS_ENABLED puede cerrar nuevos checkouts sin romper retornos.

## 2. Versiones y cadena de suministro

- [ ] P0 Next.js está en una versión soportada.
- [ ] P0 Node usa una LTS compatible y fijada.
- [ ] P0 transbank-sdk está fijado en lockfile.
- [ ] P0 cero vulnerabilidades críticas o altas sin mitigación aprobada.
- [ ] P1 npm ci, typecheck, lint, tests y build corren en CI.
- [ ] P1 Dependabot/Renovate o equivalente abre actualizaciones controladas.
- [ ] P1 escaneo de secretos en commit y CI.
- [ ] P1 ramas protegidas, revisión y checks obligatorios.
- [ ] P1 scripts de dependencias nuevas se revisan antes de instalar.
- [ ] P2 SBOM/inventario de paquetes y revisión periódica de advisories.

Baseline local del 2026-08-18: Next.js 16.3.1, Node 20, build correcto y
`npm audit --omit=dev` con 0 vulnerabilidades. CI ejecuta escaneo de secretos,
lint, tipos, Vitest, migraciones/RLS en PostgreSQL 16 y build. `xlsx`, que no
ofrecía parche, fue retirado; el reemplazo limita tamaño, filas, columnas y
encabezados. Los checks permanecen abiertos hasta verificar el despliegue.

## 3. Cuentas y accesos

- [ ] P0 MFA en Vercel, Supabase, Transbank, repositorio y correo asociado.
- [ ] P0 cada persona tiene cuenta individual; no se comparten contraseñas.
- [ ] P0 administrador de reembolsos separado de una cuenta cliente normal.
- [ ] P0 service role de Supabase solo existe en servidor.
- [ ] P1 mínimo privilegio y revisión trimestral de accesos.
- [ ] P1 códigos de recuperación guardados cifrados fuera del equipo diario.
- [ ] P1 proceso de revocación al perder un dispositivo o colaborador.
- [ ] P1 sesiones administrativas cortas y reautenticación para refunds.
- [ ] P2 registrar quién cambió variables, despliegues y configuración.

## 4. Secretos

- [ ] P0 ningún secreto usa prefijo NEXT_PUBLIC.
- [ ] P0 API Key Secret, service role y claves de jobs no están en Git.
- [ ] P0 Production, Preview y Development tienen credenciales separadas.
- [ ] P0 Preview nunca usa credenciales productivas.
- [ ] P0 logs y errores redactan Authorization, Cookie y claves.
- [ ] P1 variables obligatorias se validan al arrancar sin imprimir valores.
- [ ] P1 inventario con propietario, fecha de creación y plan de rotación.
- [ ] P1 rotación inmediata y revisión forense ante exposición.
- [ ] P1 CI no expone secretos a forks o código no confiable.
- [ ] P2 rotación periódica coordinada con Transbank y Supabase.

## 5. Catálogo, precios y stock

- [ ] P0 el cliente envía IDs/cantidades, nunca un precio confiable.
- [ ] P0 catálogo, promociones, despacho y total se recalculan en backend.
- [ ] P0 order_items guarda snapshot inmutable de precio y producto.
- [ ] P0 total CLP se calcula con enteros, nunca float.
- [ ] P0 CHECK verifica subtotal - descuento + despacho = total.
- [ ] P0 stock se reserva con lock/operación atómica.
- [ ] P0 dos compradores de la última unidad no pueden pagar ambos.
- [ ] P0 precio, stock, SKU y estado no son actualizables por clientes.
- [ ] P0 la reserva tiene vencimiento, consumo y liberación idempotentes.
- [ ] P1 cambios de precio durante checkout no alteran una orden ya iniciada.
- [ ] P0 cupones se validan server-side y contra reutilización concurrente.
- [ ] P1 devolución financiera no repone stock automáticamente.

## 6. Órdenes y pagos

- [ ] P0 orden, pago, reserva y fulfillment tienen estados separados.
- [ ] P0 buy_order, session_id y token tienen unicidad en base.
- [ ] P0 una orden admite como máximo un pago autorizado vigente.
- [ ] P0 create persiste orden/reserva antes de llamar a Webpay.
- [ ] P0 token se persiste antes de enviarlo al navegador.
- [ ] P0 callback busca por token correlacionado, no por un ID libre.
- [ ] P0 solo AUTHORIZED + response_code 0 puede marcar pago autorizado.
- [ ] P0 amount, buy_order y session_id coinciden con valores guardados.
- [ ] P0 autorización, orden paid y consumo de reserva son atómicos.
- [ ] P0 errores de red pasan a uncertain/reconciliation_required.
- [ ] P0 commit no tiene reintentos automáticos ciegos.
- [ ] P0 callbacks duplicados o concurrentes son idempotentes.
- [ ] P0 refresh/back no duplica cobro, stock, correo ni despacho.
- [ ] P0 fulfillment nace de estado persistido/outbox, no del callback web.
- [ ] P1 IDs visibles son aleatorios y no conceden autorización.
- [ ] P1 estados avanzan solo por transiciones permitidas.
- [ ] P1 reloj, expiraciones y leases usan hora del servidor.

## 7. Integración Webpay

- [ ] P0 SDK oficial ejecuta solo en servidor.
- [ ] P0 Integration usa credenciales del SDK; Production usa secretos reales.
- [ ] P0 Environment se obtiene de una allowlist, no de input.
- [ ] P0 return_url es fija, HTTPS en producción y deriva de APP_URL validada.
- [ ] P0 URL devuelta por create se limita al host oficial del ambiente.
- [ ] P0 redirección mediante formulario POST, sin iframe.
- [ ] P0 retorno normal, timeout, anulación y especial están implementados.
- [ ] P0 status se usa para reconciliar, no para aceptar datos del cliente.
- [ ] P0 tokens completos no aparecen en analytics, logs ni URLs finales.
- [ ] P1 timeouts HTTP explícitos y fallas clasificadas.
- [ ] P1 sandbox pasa la matriz y conserva evidencia redactada.
- [ ] P1 validación técnica de Transbank aprobada antes de producción.

## 8. Autenticación, sesiones y autorización

- [ ] P0 checkout invitado no confía en identidad o correo enviados.
- [ ] P0 cada request protegido valida usuario y permisos server-side.
- [ ] P0 admin/refund exige rol en backend, no un flag del frontend.
- [ ] P0 RLS habilitada y probada para anon, authenticated y admin.
- [ ] P0 service role no se usa para responder filas sin filtrado.
- [ ] P1 cookies Secure, HttpOnly y SameSite apropiado.
- [ ] P1 sesión se rota tras login/cambio de privilegio.
- [ ] P1 correo verificado si una cuenta es requisito de compra.
- [ ] P1 protección contra enumeración de usuarios y órdenes.
- [ ] P1 pruebas IDOR/BOLA para orden, comprobante, dirección y refund.

## 9. Validación de requests y abuso

- [ ] P0 schema estricto y allowlist para cada body/query/form.
- [ ] P0 límites de longitud para token, IDs, dirección y comentarios.
- [ ] P0 Content-Type y método HTTP exigidos.
- [ ] P0 protección CSRF en acciones con cookie.
- [ ] P0 Origin/Host validados en checkout y administración.
- [ ] P0 rate limit distribuido para login, checkout, retorno y refunds.
- [ ] P0 claves de idempotencia ligadas a actor y contenido.
- [ ] P1 tamaños máximos de body y timeouts.
- [ ] P1 errores públicos genéricos; detalle solo en logs redactados.
- [ ] P1 no existe open redirect ni URL externa controlada por usuario.
- [ ] P1 no existe fetch server-side hacia URL arbitraria (SSRF).
- [ ] P1 consultas parametrizadas; nada de SQL concatenado.
- [ ] P1 salida escapada; HTML de usuario sanitizado si se permite.

## 10. Navegador y headers

- [ ] P0 HTTPS y HSTS en producción.
- [ ] P1 Content-Security-Policy estricta y probada.
- [ ] P1 frame-ancestors none o política equivalente.
- [ ] P1 X-Content-Type-Options nosniff.
- [ ] P1 Referrer-Policy restrictiva.
- [ ] P1 Permissions-Policy mínima.
- [ ] P1 no cachear respuestas con PII, orden o admin.
- [ ] P1 source maps y errores no exponen secretos/rutas sensibles.
- [ ] P1 scripts de terceros reducidos al mínimo e inventariados.
- [ ] P1 analytics no captura formularios, tokens ni datos de despacho.
- [ ] P2 Subresource Integrity donde sea viable para recursos externos fijos.

## 11. Supabase y PostgreSQL

- [ ] P0 migraciones versionadas; no cambios manuales sin registro.
- [ ] P0 grants explícitos y PUBLIC revocado en funciones sensibles.
- [ ] P0 SECURITY DEFINER fija search_path seguro.
- [ ] P0 tablas de pagos/eventos/refunds no aceptan escritura del cliente.
- [ ] P0 constraints sostienen invariantes además del código TypeScript.
- [ ] P0 funciones atómicas probadas con concurrencia.
- [ ] P1 RLS no usa metadata modificable por el usuario para roles.
- [ ] P1 eventos financieros son append-only para la aplicación.
- [ ] P1 PII minimizada, con retención y borrado definidos.
- [ ] P1 backups no contienen secretos de aplicación.
- [ ] P1 producción y sandbox son proyectos separados.
- [ ] P2 revisión de Database Linter y Security Advisor sin hallazgos críticos.

## 12. Reembolsos y administración

- [ ] P0 refund solo desde backend con SDK.
- [ ] P0 admin + MFA/reautenticación + CSRF.
- [ ] P0 monto no excede saldo reembolsable.
- [ ] P0 idempotency_key evita doble refund.
- [ ] P0 motivo, actor, hora y resultado quedan auditados.
- [ ] P0 estado incierto alerta y se reconcilia.
- [ ] P1 doble confirmación para refund total o monto alto.
- [ ] P1 no se editan filas de pago manualmente como operación normal.
- [ ] P1 exportes administrativos minimizan y protegen PII.
- [ ] P2 separar quien solicita y quien aprueba sobre un umbral futuro.

## 13. Logging, monitoreo y detección

- [ ] P0 correlation_id atraviesa checkout, pago, DB y fulfillment.
- [ ] P0 logs no contienen PAN, CVV, claves, cookies ni token completo.
- [ ] P0 alertas por initialization_failed y reconciliation_required.
- [ ] P0 alertas por pagos autorizados sin orden paid o fulfillment.
- [ ] P0 alertas por reservas atascadas y stock negativo.
- [ ] P0 alertas por tasas anómalas de rechazo, 4xx, 5xx y rate limits.
- [ ] P0 destino durable de logs; no depender solo de retención de Vercel.
- [ ] P1 dashboards de latencia y error de create, commit, status y DB.
- [ ] P1 logs de admin, despliegue y cambio de configuración conservados.
- [ ] P1 relojes sincronizados y timestamps UTC en base.
- [ ] P1 salud sintética que no genera transacciones reales.
- [ ] P2 detección de nuevas rutas/endpoints sin observabilidad.

## 14. Conciliación

- [ ] P0 job recupera processing atascados y estados inciertos.
- [ ] P0 la misma función idempotente finaliza callback y reconciliación.
- [ ] P0 responsable revisa conciliación diariamente.
- [ ] P0 diferencias entre Transbank y base generan incidente.
- [ ] P1 procedimiento documentado para autorización sin fulfillment.
- [ ] P1 procedimiento para cobro duplicado y refund.
- [ ] P1 reservas no se liberan mientras un pago pueda estar autorizado.
- [ ] P1 evidencia financiera tiene acceso restringido y retención definida.

## 15. Privacidad y cumplimiento

- [ ] P0 ReskiChile nunca solicita ni almacena PAN o CVV.
- [ ] P0 tarjeta se ingresa únicamente en la página de Webpay.
- [ ] P0 política de privacidad y términos de compra reflejan el flujo real.
- [ ] P0 se recopila solo PII necesaria para comprar y despachar.
- [ ] P1 retención, acceso, exportación y borrado de PII documentados.
- [ ] P1 proveedores con acceso a datos inventariados.
- [ ] P1 respuesta a solicitudes y brechas definida conforme a asesoría local.
- [ ] P1 cumplimiento PCI validado con el adquirente/asesor correspondiente.

El uso de Webpay alojado reduce alcance técnico de tarjeta, pero no autoriza a
declararse automáticamente conforme a PCI DSS. La validación exacta se confirma
con Transbank y, si corresponde, un profesional.

## 16. Respuesta a incidentes

- [ ] P0 contactos y canal de emergencia documentados.
- [ ] P0 capacidad de cerrar nuevos pagos de inmediato.
- [ ] P0 callbacks y reconciliación permanecen disponibles al cerrar checkout.
- [ ] P0 procedimiento de rotación de claves probado.
- [ ] P0 no borrar evidencia ni “arreglar” pagos editando estados.
- [ ] P1 severidades, responsables y comunicaciones definidas.
- [ ] P1 imagen/restauración limpia y redeploy reproducible.
- [ ] P1 simulacro: secreto filtrado, Supabase caído y pago incierto.
- [ ] P1 postmortem sin culpa con acciones, responsables y fechas.

## 17. Gate final

Pagos productivos solo pueden activarse cuando:

- todos los P0 están cerrados con evidencia;
- todo P1 está cerrado o tiene excepción escrita, compensación, propietario y
  vencimiento;
- Transbank aprobó la validación;
- compra real CLP 50 y devolución se conciliaron;
- restauración y respuesta a pago incierto fueron ensayadas;
- negocio y técnico firman fecha, versión desplegada y rollback.

Referencias base:

- [Seguridad recomendada por Transbank](https://www.transbankdevelopers.cl/documentacion/como_empezar)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/)
- [Supabase: producción](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Vercel Security](https://vercel.com/docs/security)
