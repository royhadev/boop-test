import WithdrawClient from "./WithdrawClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fid?: string }>;
}) {
  const sp = await searchParams;
  const fid = sp?.fid || "";
  return <WithdrawClient fid={fid} />;
}
