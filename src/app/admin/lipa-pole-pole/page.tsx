import LipaPolePoleAdminClient from "./LipaPolePoleAdminClient";
import {
  loadLipaPolePoleAdminWorkspace,
  type LipaPolePoleSearchParams,
} from "./loadLipaPolePoleAdminWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminLipaPolePolePage({
  searchParams,
}: {
  searchParams?: Promise<LipaPolePoleSearchParams>;
}) {
  const workspace = await loadLipaPolePoleAdminWorkspace((await searchParams) || {});
  return <LipaPolePoleAdminClient {...workspace} />;
}
