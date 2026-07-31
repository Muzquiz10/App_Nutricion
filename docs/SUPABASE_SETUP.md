# Configuracion de Supabase para NutriOS

## 1. Crear el proyecto

1. Entra en Supabase y crea un proyecto nuevo.
2. Ve a `Project Settings > API`.
3. Copia `Project URL`, `anon public key` y `service_role key`.
4. Crea un archivo `.env.local` copiando `.env.example`.
5. Rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NUTRIOS_ROOT_DOMAIN=tuapp.com
NUTRIOS_DEFAULT_TENANT_SLUG=maria
```

La `service_role key` solo debe existir en servidor. No la pongas nunca en codigo cliente ni en variables que empiecen por `NEXT_PUBLIC_`.

`NEXT_PUBLIC_SUPABASE_URL` debe ser la URL base del proyecto. No anadas `/rest/v1` y no pongas comentarios al final de la linea.

## 2. Crear tablas, seguridad y Storage

1. Abre `SQL Editor` en Supabase.
2. Copia y ejecuta el contenido de `supabase/migrations/202607300001_initial_nutrios_schema.sql`.
3. La migracion crea:
   - tenants para cada nutricionista.
   - perfiles y roles.
   - pacientes.
   - invitaciones.
   - dietas.
   - registros de peso, cintura, ejercicio y fotos.
   - documentos.
   - chat.
   - consentimientos GDPR.
   - politicas RLS.
   - bucket privado `nutrios-private`.
   - bucket publico `nutrios-branding` para logos.

Si ya habias ejecutado la migracion inicial antes de estos cambios, ejecuta tambien:

```text
supabase/migrations/202607310001_nutritionist_panel_updates.sql
```

Esta migracion anade el estado `active/archived` de pacientes, crea el bucket de logos y limita los registros de seguimiento para que los inserte el propio cliente.

Para que el chat se actualice en vivo entre nutricionista y cliente, ejecuta tambien:

```text
supabase/migrations/202607310002_chat_realtime.sql
```

Sin esta migracion, los mensajes se guardan, pero el otro navegador podria necesitarlos ver tras recargar.

## 3. Configurar Auth

En `Authentication > URL Configuration`:

```text
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/auth/callback
http://localhost:3000/**
https://*.tuapp.com/auth/callback
https://*.tuapp.com/**
```

En `Authentication > Providers > Email`, deja activo Email. Para una app cerrada por invitacion, desactiva el registro publico si tu panel lo permite.

Supabase permite enviar invitaciones desde servidor con `auth.admin.inviteUserByEmail`. La app ya lo llama desde `/api/invitations/create`.

Durante pruebas, Supabase puede mostrar `email rate limit exceeded` porque el SMTP incluido tiene un limite muy bajo. En ese caso NutriOS creara la invitacion igualmente y mostrara un enlace manual de Supabase para copiarlo y enviarlo al cliente. Para produccion configura SMTP propio en `Authentication > SMTP Settings`.

## 4. Crear el primer nutricionista

Primero crea tu usuario nutricionista en `Authentication > Users`.

Despues ejecuta este SQL cambiando el correo y los datos:

```sql
with created_tenant as (
  insert into public.tenants (slug, name, primary_color, privacy_policy_url)
  values ('maria', 'Nutricion Maria', '#2f7d6d', null)
  on conflict (slug) do update
  set name = excluded.name,
      primary_color = excluded.primary_color
  returning id
),
selected_user as (
  select id
  from auth.users
  where email = 'TU_CORREO@EJEMPLO.COM'
)
insert into public.profiles (user_id, full_name, global_role)
select selected_user.id, 'Maria Nutricionista', 'nutritionist'
from selected_user
on conflict (user_id) do update
set full_name = excluded.full_name,
    global_role = excluded.global_role;

with tenant as (
  select id from public.tenants where slug = 'maria'
),
selected_user as (
  select id from auth.users where email = 'TU_CORREO@EJEMPLO.COM'
)
insert into public.tenant_members (tenant_id, user_id, role, status)
select tenant.id, selected_user.id, 'owner', 'active'
from tenant, selected_user
on conflict (tenant_id, user_id) do update
set role = excluded.role,
    status = excluded.status;
```

Con esto `maria.tuapp.com` cargara la marca de Maria. En local puedes probar con `http://localhost:3000/n/maria` o con el slug por defecto en `/`.

## 5. Emails de invitacion

Para produccion conviene revisar `Authentication > Email Templates > Invite user`.

El enlace de Supabase redirige a:

```text
/auth/callback?next=/invitacion/{token}
```

Cuando el paciente acepta, NutriOS le pide:

- nombre y apellidos
- edad
- altura
- peso actual
- alergias/intolerancias
- alimentos a evitar
- ejercicio
- contrasena
- consentimiento de tratamiento de datos

El ID interno del paciente, la fecha de registro y el primer registro de peso se generan en servidor.

## 6. Subdominios

Para `maria.tuapp.com` necesitas que tu proveedor de hosting acepte wildcard domains y que el DNS tenga un registro parecido a:

```text
*.tuapp.com -> tu hosting
```

La app lee el subdominio y lo cruza con `tenants.slug`. No hay una base de datos por nutricionista ni por paciente: hay una base compartida con `tenant_id` y RLS.
