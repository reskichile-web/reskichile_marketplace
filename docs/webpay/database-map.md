# Mapa visual: producto, orden y pago

Estado local después de las seis migraciones hasta `202608180002`.

## Flujo completo

```mermaid
flowchart LR
    B[Comprador] -->|IDs + contacto + despacho| N[Next.js checkout]
    N -->|RPC atómica| DB[(Supabase / PostgreSQL)]
    DB -->|orden + reserva + total| N
    N -->|Transaction.create| T[Webpay Plus]
    B -->|POST token_ws| T
    T -->|retorno al dominio canónico| R[API return]
    R -->|commit una sola vez<br/>o status| T
    R -->|finalización atómica| DB
    C[Supabase Cron] -->|POST cada minuto| J[API reconcile]
    J -->|status solamente| T
    J -->|finaliza o reintenta| DB
    C -->|POST cada minuto| W[API commerce outbox]
    W -->|claim + resultado| DB
    W -->|Idempotency-Key| E[Correo / alertas]
    DB -->|estado protegido por cookie| V[Página resultado]
    V -->|refresh automático| DB

    style T fill:#f4b41a,color:#111,stroke:#8a6500
    style DB fill:#3ecf8e,color:#071b12,stroke:#18794e
    style N fill:#111827,color:#fff,stroke:#111827
    style R fill:#111827,color:#fff,stroke:#111827
    style J fill:#111827,color:#fff,stroke:#111827
    style W fill:#111827,color:#fff,stroke:#111827
```

## Relaciones de base de datos

```mermaid
erDiagram
    AUTH_USERS ||--|| USERS : "perfil"
    USERS ||--o{ PRODUCTS : "seller_id legado"
    SHIPPING_ORIGINS ||--o{ PRODUCTS : "origen de cada pieza"

    AUTH_USERS o|--o{ ORDERS : "comprador opcional"
    ORDERS ||--|{ ORDER_ITEMS : "snapshot de compra"
    PRODUCTS ||--o{ ORDER_ITEMS : "pieza comprada"

    ORDERS ||--|{ INVENTORY_RESERVATIONS : "aparta stock"
    PRODUCTS ||--o{ INVENTORY_RESERVATIONS : "máx. una retenida"

    ORDERS ||--|{ SHIPPING_QUOTES : "cotización elegida"
    SHIPPING_ORIGINS ||--o{ SHIPPING_QUOTES : "sale desde"

    ORDERS ||--|{ PAYMENT_ATTEMPTS : "intentos Webpay"
    PAYMENT_ATTEMPTS ||--o{ PAYMENT_EVENTS : "auditoría"
    ORDERS ||--o{ PAYMENT_EVENTS : "historial"

    PROMOTIONS ||--o{ PROMOTION_REDEMPTIONS : "reserva cupón"
    ORDERS ||--o{ PROMOTION_REDEMPTIONS : "aplica a"

    PAYMENT_ATTEMPTS ||--o{ REFUNDS : "devoluciones"
    ORDERS ||--o{ REFUNDS : "impactan orden"
    ORDERS ||--o{ COMMERCE_OUTBOX : "confirmación y operación"
```

## Centro del modelo

```mermaid
flowchart TB
    P[products<br/>1 fila = 1 pieza única<br/>commerce_owned = true] --> OI[order_items<br/>precio y nombre congelados]
    P --> IR[inventory_reservations<br/>índice único por product_id]
    RP[ski_rack_products<br/>precio + paquete] --> RI[ski_rack_inventory<br/>producto + talla + origen + stock]
    SO[shipping_origins<br/>Los Ángeles / Las Condes] --> RI
    RI --> OI
    RI --> IR
    O[orders<br/>comprador + total + despacho] --> OI
    O --> IR
    O --> PA[payment_attempts<br/>buy_order + session_id + token]
    PA --> PE[payment_events<br/>append-only]
    PA --> RF[refunds<br/>RPC + panel admin + auditoría]
    O --> CO[commerce_outbox<br/>correo + fulfillment + alertas]

    IR -->|authorized| SOLD[consumed + product sold]
    IR -->|rechazo/anulación| FREE[released]
    IR -->|duda| HOLD[reconciliation_required<br/>NO liberar]

    style HOLD fill:#fff3cd,stroke:#b58105
    style SOLD fill:#d1fae5,stroke:#047857
    style FREE fill:#e5e7eb,stroke:#4b5563
```

## Estados coordinados

```mermaid
stateDiagram-v2
    state "payment_attempt" as P {
      [*] --> created
      created --> initialized
      created --> initialization_failed
      initialized --> processing: claim commit
      initialized --> aborted
      initialized --> expired
      processing --> authorized
      processing --> rejected
      processing --> reconciliation_required: respuesta incierta
      reconciliation_required --> authorized: status
      reconciliation_required --> rejected: status
      reconciliation_required --> aborted: status
      reconciliation_required --> expired: status
    }

    state "inventory_reservation" as I {
      [*] --> active
      active --> payment_processing
      payment_processing --> consumed: autorizado
      payment_processing --> released: rechazado/anulado
      payment_processing --> reconciliation_required: incierto
      reconciliation_required --> consumed: status autorizado
      reconciliation_required --> released: status terminal
      active --> expired: sin commit iniciado
    }
```

## Regla de confianza

```text
Navegador: producto + datos de entrega
      │
      ├── nunca decide precio, descuento, despacho o estado de pago
      ▼
PostgreSQL: orden + stock + snapshots
      │
      ├── solo acepta AUTHORIZED + response_code 0 + correlación exacta
      ▼
Transbank: autoridad del pago; aloja tarjeta y autenticación bancaria
```
