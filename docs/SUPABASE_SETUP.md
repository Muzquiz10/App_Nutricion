# Configuración de Supabase para B-aura Connect

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
RESEND_API_KEY=...
SUPPORT_FROM_EMAIL="B-aura Connect <soporte@tu-dominio.com>"
SUPPORT_TO_EMAIL=ej.egmanalytics@gmail.com
NOTIFICATIONS_FROM_EMAIL="B-aura Connect <notificaciones@tu-dominio.com>"
NOTIFICATIONS_CONTACT_EMAIL=ej.egmanalytics@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ej.egmanalytics@gmail.com
NOTIFICATION_JOB_SECRET=...
```

La `service_role key` solo debe existir en servidor. No la pongas nunca en codigo cliente ni en variables que empiecen por `NEXT_PUBLIC_`.

`NEXT_PUBLIC_SUPABASE_URL` debe ser la URL base del proyecto. No anadas `/rest/v1` y no pongas comentarios al final de la linea.

Para el boton de asistencia tecnica necesitas una cuenta de Resend y un dominio/remitente validado. `SUPPORT_TO_EMAIL` es opcional si se mantiene `ej.egmanalytics@gmail.com`.

Para notificaciones push ejecuta `npm run vapid:generate` y copia los valores generados en las variables VAPID. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` es publica; `VAPID_PRIVATE_KEY` debe tratarse como secreta.

## 2. Crear tablas, seguridad y Storage

1. Abre `SQL Editor` en Supabase.
2. Copia y ejecuta el contenido de `supabase/migrations/202607300001_initial_nutrios_schema.sql`.
3. Ejecuta tambien las migraciones posteriores en orden, incluida `supabase/migrations/202608040001_appointments_calendar.sql` para activar Agenda y Citas.
4. La migracion inicial crea:
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

Esta migracion anade el estado de pacientes, crea el bucket de logos y limita los registros de seguimiento para que los inserte el propio cliente.

Para que el chat se actualice en vivo entre nutricionista y cliente, ejecuta tambien:

```text
supabase/migrations/202607310002_chat_realtime.sql
```

Sin esta migracion, los mensajes se guardan, pero el otro navegador podria necesitarlos ver tras recargar.

Para activar el cuestionario actualizado, objetivo, sexo para calculo basal, ejercicio separado, IMC y TMB, ejecuta tambien:

```text
supabase/migrations/202608010001_questionnaire_metrics.sql
```

Los clientes ya activos podran completar los campos nuevos desde `Mi Ficha Personal`.

Para usar clientes antiguos como estado inactivo real, ejecuta tambien:

```text
supabase/migrations/202608020003_patient_inactive_status.sql
```

Esta migracion cambia los pacientes antiguos de `archived` a `inactive`. Cuando un nutricionista mueve un cliente a antiguos, B-aura Connect desactiva tambien su acceso en ese nutricionista y permite reactivarlo despues.

Para bloquear que un mismo cliente este activo con dos nutricionistas a la vez, ejecuta tambien:

```text
supabase/migrations/202608020004_one_active_patient_per_user.sql
```

Esta migracion sincroniza fichas inactivas con membresias `disabled` y crea indices unicos para permitir solo una ficha/membresia activa por usuario paciente.

Para activar la ficha clinica ampliada del cliente y guardar el email en `patients`, ejecuta tambien:

```text
supabase/migrations/202608270001_patient_clinical_record.sql
```

Esta migracion anade campos de consulta para datos generales, motivo, anamnesis, datos antropometricos/bioquimicos, habitos alimentarios, conocimientos y actividad fisica.

Para activar notificaciones de chat, preferencias de usuario, Web Push y fallback por email, ejecuta tambien:

```text
supabase/migrations/202608120001_chat_notifications.sql
```

El fallback por email queda preparado con Resend. Para que funcione incluso si nadie tiene la app abierta, configura un cron externo o de Supabase que llame cada minuto a:

```text
POST https://TU_DOMINIO/api/notifications/process-email-fallback
Header: x-notification-job-secret: VALOR_DE_NOTIFICATION_JOB_SECRET
Body: {}
```

En Supabase puedes hacerlo desde `Database > Extensions`, activando `pg_cron` y `pg_net`, y despues ejecutando este SQL en `SQL Editor`:

```sql
select cron.schedule(
  'baura-connect-email-fallback',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://nutrios.egmanalytics.com/api/notifications/process-email-fallback',
    headers := '{"Content-Type":"application/json","x-notification-job-secret":"PEGA_AQUI_NOTIFICATION_JOB_SECRET"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

`PEGA_AQUI_NOTIFICATION_JOB_SECRET` debe ser el mismo valor configurado en local y en produccion. Si necesitas recrearlo, genera un valor aleatorio largo y actualiza `NOTIFICATION_JOB_SECRET` en ambos sitios.

## 3. Configurar Auth

En `Authentication > URL Configuration`:

```text
Site URL:
http://localhost:3000

Redirect URLs:
http://localhost:3000/auth/callback
http://localhost:3000/**
https://nutrios.egmanalytics.com/auth/callback
https://nutrios.egmanalytics.com/**
https://*.tuapp.com/auth/callback
https://*.tuapp.com/**
```

En `Authentication > Providers > Email`, deja activo Email. Para una app cerrada por invitacion, desactiva el registro publico si tu panel lo permite.

Supabase permite enviar invitaciones desde servidor con `auth.admin.inviteUserByEmail`. La app ya lo llama desde `/api/invitations/create`.

El enlace de "Has olvidado tu contraseña?" usa el mismo callback y después lleva al usuario a `/auth/reset-password` para crear una nueva contraseña.

Durante pruebas, Supabase puede mostrar `email rate limit exceeded` porque el SMTP incluido tiene un limite muy bajo. En ese caso B-aura Connect creara la invitacion igualmente y mostrara un enlace manual de Supabase para copiarlo y enviarlo al cliente. Para produccion configura SMTP propio en `Authentication > SMTP Settings`.

## 4. Crear el primer nutricionista

Primero crea tu usuario nutricionista en `Authentication > Users`.

Despues ejecuta este SQL cambiando el correo y los datos:

```sql
with created_tenant as (
  insert into public.tenants (slug, name, primary_color, privacy_policy_url)
  values ('maria', 'Nutricion Maria', '#71c176', null)
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

Cuando el paciente acepta, B-aura Connect le pide:

- nombre y apellidos
- edad
- altura
- peso actual
- alergias/intolerancias
- alimentos a evitar
- ejercicio
- contraseña
- consentimiento de tratamiento de datos

El ID interno del paciente, la fecha de registro y el primer registro de peso se generan en servidor.

## 6. Subdominios

Para `maria.tuapp.com` necesitas que tu proveedor de hosting acepte wildcard domains y que el DNS tenga un registro parecido a:

```text
*.tuapp.com -> tu hosting
```

La app lee el subdominio y lo cruza con `tenants.slug`. No hay una base de datos por nutricionista ni por paciente: hay una base compartida con `tenant_id` y RLS.
