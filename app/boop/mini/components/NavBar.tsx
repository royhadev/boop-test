"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function buildHref(path: string, fid: string | null) {
  if (!fid) return path;
  const u = new URL(path, "http://local");
  u.searchParams.set("fid", fid);
  return u.pathname + "?" + u.searchParams.toString();
}

export default function NavBar() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const fid = sp.get("fid");

  const links = [
    { label: "Home", path: "/boop/mini" },
    { label: "Stake", path: "/boop/mini/stake" },
    { label: "Withdraw", path: "/boop/mini/withdraw" },
    { label: "Leaderboard", path: "/boop/mini/leaderboard" },
  ];

  return (
    <div className="mb-4">
      <div className="text-yellow-300 font-semibold">BoopApp</div>
      <div className="text-xs opacity-70 mb-2">Miniapp • Engage • Earn</div>

      <div className="flex gap-4 text-sm">
        {links.map((l) => {
          const href = buildHref(l.path, fid);
          const active =
            (l.path === "/boop/mini" && pathname === "/boop/mini") ||
            (l.path !== "/boop/mini" && pathname.startsWith(l.path));

          return (
            <Link
              key={l.path}
              href={href}
              className={`transition ${
                active ? "text-yellow-300" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      {/* Debug کوچک (اختیاری) */}
      <div className="mt-2 text-xs opacity-50">fid: {fid ?? "—"}</div>
    </div>
  );
}
