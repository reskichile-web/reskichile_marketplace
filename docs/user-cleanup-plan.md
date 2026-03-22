# Plan de Limpieza de Usuarios

> **Estado**: Pendiente de confirmación
> **Fecha**: 2026-03-22

---

## Contexto

Se contactó a los vendedores antiguos (importados desde Excel) para confirmar quiénes quieren seguir participando en la plataforma. Se usó la flag `keep` en la tabla `users` para clasificarlos desde la vista de admin/contacto.

Los productos y sus métricas (precio original, precio de venta real, estado) son datos valiosos que deben preservarse independientemente de si el usuario se mantiene o no.

---

## Estado actual de usuarios

| Clasificación | Cantidad | Acción |
|---|---|---|
| `keep: true` | 12 | Se mantienen intactos |
| `keep: false` | 16 | Se procesan para eliminación |
| `keep: null` | 46 | Pendientes de clasificar |
| **Admins** (protegidos) | 3 | Nunca se eliminan |

### Usuarios `keep: true` (se mantienen)
| Nombre | Email |
|---|---|
| Alonso Filla | alonsofilla30@gmail.com |
| Bastian Jeria | bastianjeriaromero@gmail.com |
| David Torti | torti4@gmail.com |
| Facundo Marguiraut | facundomarguiraut2mb@gmail.com |
| Jaime Ariel | jaimefarmer70@gmail.com |
| Juan José Paz | jjpazg88@gmail.com |
| Martín Oliger | martinoligerg@gmail.com |
| Matias Lopez | matiaslopezsoza1@gmail.com |
| Matías Silva | contreras.silva.matias@gmail.com |
| Melanie Pirce | melanie.pirce@gmail.com |
| Renato Zúñiga | renato.z2003@gmail.com |
| Sebastián Calderón Díaz | sebastian1165@gmail.com |

### Usuarios `keep: false` (se eliminan)
| Nombre | Email |
|---|---|
| Baltazar Calera | baltazar33c@gmail.com |
| Camilo Andres | camilo.fuentea@gmail.com |
| Caye Galilea | cayegali11@gmail.com |
| Claudio Chacon | cchaconbahamondes@gmail.com |
| Cristian Iván | cristian.aravenasoto@gmail.com |
| Eduardo Osorio | eduardoo9614@gmail.com |
| Francisco Leiva Burgos | f.leivab2019@gmail.com |
| Martin Reyes Vercellino | mirv2003@gmail.com |
| Max Barros | maxbarrosp@gmail.com |
| Pacheco Inostroza Ed | eduardopacheco1350@gmail.com |
| Pascual Bengoa | pbengoa@uc.cl |
| Rafael Espinosa Gálvez | rafaespinosa@gmail.com |
| Salvador Cofre | salva0cofre01@gmail.com |
| Sebastián Calleja Lorenzini | scallejalorenzini@gmail.com |
| Verena Verena Hörmann | vere.hormann@gmail.com |
| Vicente González | sayesvicente8@gmail.com |
| Zwen Franulic | zfranulic@gmail.com |

### Admins (protegidos, nunca se eliminan)
| Nombre | Email |
|---|---|
| Sebastian | sebastian.derpsch@gmail.com |
| Ignacio Mundaca | ignaciomundaca01@gmail.com |
| — | reskichile@gmail.com |

---

## Plan de Ejecución

### Paso 1: Crear tabla `email_contacts`

Tabla para preservar emails de usuarios eliminados para futuro email marketing.

```sql
CREATE TABLE public.email_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text,
  source text DEFAULT 'imported',  -- 'imported', 'registered', 'manual'
  created_at timestamptz DEFAULT now()
);

-- Sin RLS — solo accesible desde server/admin
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contacts" ON public.email_contacts
  FOR ALL USING (is_admin());
```

### Paso 2: Copiar emails de usuarios `keep: false` a `email_contacts`

```sql
INSERT INTO public.email_contacts (email, name, source)
SELECT email, name, 'imported'
FROM public.users
WHERE keep = false;
```

### Paso 3: Desvincular productos de usuarios `keep: false`

Los productos se mantienen con toda su data (precio, sale_price, status, atributos, imágenes). Solo se quita la referencia al vendedor.

```sql
UPDATE public.products
SET seller_id = NULL
WHERE seller_id IN (
  SELECT id FROM public.users WHERE keep = false
);
```

### Paso 4: Eliminar usuarios de tabla `users`

```sql
DELETE FROM public.users WHERE keep = false;
```

### Paso 5: Eliminar usuarios de `auth.users`

```sql
DELETE FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
  AND id NOT IN (
    -- Proteger admins por si acaso
    SELECT id FROM public.users WHERE is_admin = true
  );
```

> **Nota**: Este paso elimina la capacidad de login de estos usuarios. Si alguno quiere volver, deberá registrarse de nuevo.

### Paso 6: Verificación

```sql
-- Verificar que no quedaron productos rotos
SELECT count(*) as orphaned_products FROM public.products WHERE seller_id IS NULL;

-- Verificar emails guardados
SELECT count(*) as saved_contacts FROM public.email_contacts;

-- Verificar usuarios restantes
SELECT count(*) as remaining_users FROM public.users;

-- Verificar que admins siguen intactos
SELECT email, is_admin FROM public.users WHERE is_admin = true;
```

---

## Qué se preserva

| Dato | ¿Se mantiene? | Dónde |
|---|---|---|
| Productos | ✅ Sí | `products` (seller_id = null) |
| Precio original | ✅ Sí | `products.price` |
| Precio de venta real | ✅ Sí | `products.sale_price` |
| Estado del producto | ✅ Sí | `products.status` |
| Imágenes del producto | ✅ Sí | `product_images` |
| Atributos del producto | ✅ Sí | `products.attributes` |
| Checks de contacto | ✅ Sí | `products.contact_user_checked`, etc. |
| Email del vendedor | ✅ Sí | `email_contacts` |
| Nombre del vendedor | ✅ Sí | `email_contacts` |
| Teléfono del vendedor | ❌ No | Se elimina con el usuario |
| Instagram del vendedor | ❌ No | Se elimina con el usuario |
| Cuenta auth (login) | ❌ No | Se elimina de auth.users |

## Qué se elimina

| Dato | Tabla |
|---|---|
| Perfil del usuario | `public.users` |
| Auth credentials | `auth.users` |
| Vinculación producto-vendedor | `products.seller_id` → null |

---

## Decisiones pendientes (confirmar antes de ejecutar)

- [ ] ¿Procesar los 16 usuarios `keep: false`? → **Sí / No**
- [ ] ¿Qué hacer con los `keep: null`? → **Dejar como están / Clasificar primero / Eliminar también**
- [ ] ¿Productos de eliminados quedan `approved` (visibles) o se pasan a `archived`?
- [ ] ¿Guardar también teléfono en `email_contacts`? → **Sí / No**

---

## Ejecución

Una vez confirmadas las decisiones, ejecutar los pasos 1-6 en orden usando el MCP de Supabase (`mcp__supabase__execute_sql` y `mcp__supabase__apply_migration`).

Tiempo estimado de ejecución: < 5 minutos.
