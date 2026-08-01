import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

type DeleteMealPhotoBody = {
  photoId?: string;
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

  const body = (await request.json()) as DeleteMealPhotoBody;
  if (!body.photoId) {
    return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  }

  const { data: photo, error: photoError } = await supabase
    .from("meal_photos")
    .select("id,tenant_id,patient_id,storage_path")
    .eq("id", body.photoId)
    .maybeSingle();

  if (photoError || !photo) {
    return NextResponse.json({ error: "Foto no encontrada." }, { status: 404 });
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id,user_id,tenant_id")
    .eq("id", photo.patient_id)
    .eq("tenant_id", photo.tenant_id)
    .maybeSingle();

  if (patientError || !patient) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  if (patient.user_id !== user.id) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role,status")
      .eq("tenant_id", photo.tenant_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "nutritionist"].includes(membership.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para borrar esta foto." },
        { status: 403 },
      );
    }
  }

  const { error: deleteRowError } = await supabase
    .from("meal_photos")
    .delete()
    .eq("id", photo.id);

  if (deleteRowError) {
    return NextResponse.json({ error: deleteRowError.message }, { status: 500 });
  }

  const { error: storageError } = await supabase.storage
    .from("nutrios-private")
    .remove([photo.storage_path]);

  if (storageError) {
    return NextResponse.json({
      ok: true,
      warning:
        "La foto se ha retirado del panel, pero no se pudo borrar el archivo del almacenamiento.",
    });
  }

  return NextResponse.json({ ok: true });
}
