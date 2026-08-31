# Version SaaS basica

## 1. Crear tablas en Supabase

Abre tu proyecto en Supabase, entra a **SQL Editor**, pega todo el contenido de:

`supabase-schema.sql`

Luego ejecuta el SQL. Eso crea:

- `profiles`
- `subscriptions`
- `clients`
- `loans`
- `payments`
- `plan_requests`
- politicas RLS para que cada usuario vea solo sus datos
- permisos admin para que tu cuenta pueda ver usuarios, solicitudes y planes

## 2. Activar tu cuenta de administrador

Despues de ejecutar `supabase-schema.sql`, en Supabase abre **SQL Editor** y ejecuta esto cambiando el correo por el tuyo:

```sql
update profiles
set is_admin = true
where id = (select id from auth.users where email = 'TU_CORREO_AQUI');
```

Ejemplo:

```sql
update profiles
set is_admin = true
where id = (select id from auth.users where email = 'mi_correo@gmail.com');
```

Luego cierra sesion en tu web y vuelve a iniciar sesion. Te aparecera la seccion **Admin**.

## 3. Pegar claves publicas

En Supabase ve a **Project Settings > API Keys** y copia:

- Project URL
- Publishable key o anon public key

Luego abre `supabase-config.js` y rellena:

```js
window.SUPABASE_CONFIG = {
  url: "TU_PROJECT_URL",
  publishableKey: "TU_PUBLISHABLE_KEY",
};
```

No pegues `service_role`, `secret key` ni la contrasena de la base de datos en esta web.

## 4. Probar el SaaS

Para abrir la web desde archivo puedes usar `index.html`.

Para recuperar contrasenas, abre la web con el servidor local:

```text
iniciar-web.bat
```

Luego entra a:

```text
http://localhost:3000/index.html
```

- Si `supabase-config.js` esta vacio, funciona en modo demo local.
- Si las claves estan pegadas, aparece registro/login real.
- El plan gratis permite hasta 10 clientes.

## 5. Siguiente paso para vender

Cuando esta base funcione, el siguiente paso es conectar pagos:

- Stripe para venta internacional.
- Mercado Pago para Peru o Latinoamerica.

La tabla `subscriptions` ya esta preparada para cambiar planes y limites.

## 6. Aprobar un plan manualmente

Mientras no haya pasarela de pago, puedes cambiar un usuario de plan desde el panel **Admin** de tu web.

Tambien puedes hacerlo desde Supabase:

En **Table Editor > subscriptions**, edita la fila del usuario:

- Gratis: `plan = free`, `client_limit = 10`
- Basico: `plan = basic`, `client_limit = 100`
- Pro: `plan = pro`, `client_limit = null`

Las solicitudes de los usuarios quedan en:

`plan_requests`

Cuando conectemos Mercado Pago o Stripe, este cambio se hara automaticamente despues del pago.
