import StakeClient from "./StakeClient";

export default async function StakePage({
  searchParams,
}: {
  searchParams: Promise<{ fid?: string }>;
}) {
  const sp = await searchParams;
  const fid = sp?.fid ? String(sp.fid) : "";

  return <StakeClient fid={fid} />;
}
