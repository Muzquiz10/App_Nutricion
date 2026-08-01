# NutriDesk

NutriDesk es un MVP web para nutricionistas. Cada profesional inicia sesion con su correo y contrasena, y sus pacientes quedan aislados por `tenant_id` y politicas RLS en Supabase.

## MVP incluido

- Panel para nutricionista.
- Invitacion de clientes por email.
- Alta del cliente con ficha inicial y consentimiento.
- ID interno de paciente y fecha de registro automaticos.
- Dietas semanales.
- Registro de peso, cintura, ejercicio y fotos de comidas.
- Chat entre nutricionista y cliente.
- Documentacion complementaria.
- Personalizacion de nombre, logo, color y politica de privacidad.
- Esquema GDPR-ready con roles, consentimiento y aislamiento por nutricionista.

## Desarrollo local

```bash
npm install
npm run dev
```

Sin `.env.local`, la app abre en modo demo para revisar la interfaz. Para conectarla a Supabase, copia `.env.example` a `.env.local` y sigue `docs/SUPABASE_SETUP.md`.

## Comandos

```bash
npm run dev
npm run build
npm test
```
