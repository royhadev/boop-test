import StakeTabs from "@/components/StakeTabs";

type SP = { fid?: string };

// ✅ Next 16: searchParams can be Promise in dynamic routes
export default async function MiniStakePage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = props.searchParams
    ? await Promise.resolve(props.searchParams)
    : ({} as SP);

  const fidRaw = sp?.fid ?? "";
  const fidNum = Number(fidRaw);
  const fid = Number.isFinite(fidNum) && fidNum > 0 ? fidNum : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b10",
        color: "#fff",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ padding: "14px 14px 0" }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            fid: {fid ? fid : "—"}
          </div>
        </div>

        {fid ? (
          // ✅ key باعث میشه با تغییر fid، state داخلی StakeTabs هم تازه‌سازی بشه
          <StakeTabs key={`stake-tabs-${fid}`} fid={fid} />
        ) : (
          <div style={{ padding: 14, color: "#ff6b6b" }}>
            Missing fid in URL. Use: <code>?fid=121</code>
          </div>
        )}
      </div>
    </div>
  );
}
