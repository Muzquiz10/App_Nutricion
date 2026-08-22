import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type PatientProfilePhotoBody = {
  patientId?: string;
  profilePhotoPath?: string;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase no esta configurado en el servidor." },
      { status: 500 },
    );
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return NextResponse.json({ error: "Sesion no encontrada." }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  const body = (await request.json()) as PatientProfilePhotoBody;
  if (!body.patientId || !body.profilePhotoPath) {
    return NextResponse.json(
      { error: "Faltan la ficha o la foto de perfil." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,tenant_id,user_id,profile_photo_path")
    .eq("id", body.patientId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (patientError || !patient) {
    return NextResponse.json(
      { error: "No se encontro una ficha vinculada a tu usuario." },
      { status: 404 },
    );
  }

  const expectedPrefix = `${patient.tenant_id}/${patient.id}/profile-photos/`;
  if (
    !body.profilePhotoPath.startsWith(expectedPrefix) ||
    body.profilePhotoPath.length > 500
  ) {
    return NextResponse.json(
      { error: "La ruta de la foto no corresponde a tu ficha." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("patients")
    .update({
      profile_photo_path: body.profilePhotoPath,
      updated_at: now,
    })
    .eq("id", patient.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (
    patient.profile_photo_path &&
    patient.profile_photo_path !== body.profilePhotoPath
  ) {
    await supabase.storage
      .from("nutrios-private")
      .remove([patient.profile_photo_path]);
  }

  return NextResponse.json({
    ok: true,
    profilePhotoPath: body.profilePhotoPath,
  });
}
