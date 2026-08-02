import type { SupabaseClient, User } from "@supabase/supabase-js";

export type PatientActivationBlock =
  | "active_in_same_tenant"
  | "active_in_other_tenant"
  | "existing_in_same_tenant";

export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) return null;

    const match = data.users.find(
      (user: User) => user.email?.toLowerCase() === normalizedEmail,
    );
    if (match) return match;
    if (!data.nextPage) return null;
  }

  return null;
}

export async function getPatientActivationBlock(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<PatientActivationBlock | null> {
  const { data: activeMembershipRows } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "patient")
    .eq("status", "active");

  const activeMembership = (activeMembershipRows ?? [])[0];
  if (activeMembership) {
    return activeMembership.tenant_id === tenantId
      ? "active_in_same_tenant"
      : "active_in_other_tenant";
  }

  const { data: activePatientRows } = await supabase
    .from("patients")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const activePatient = (activePatientRows ?? [])[0];
  if (activePatient) {
    return activePatient.tenant_id === tenantId
      ? "active_in_same_tenant"
      : "active_in_other_tenant";
  }

  const { data: sameTenantRows } = await supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .limit(1);

  if ((sameTenantRows ?? []).length > 0) {
    return "existing_in_same_tenant";
  }

  return null;
}

export function patientActivationBlockMessage(block: PatientActivationBlock) {
  if (block === "active_in_other_tenant") {
    return "Ese correo ya esta activo con otro nutricionista. Para darlo de alta aqui, primero el nutricionista actual debe moverlo a clientes antiguos.";
  }

  if (block === "active_in_same_tenant") {
    return "Ese correo ya esta activo en este nutricionista.";
  }

  return "Ese correo ya tiene una ficha antigua en este nutricionista. Reactivalo desde Clientes antiguos en lugar de crear una invitacion nueva.";
}
