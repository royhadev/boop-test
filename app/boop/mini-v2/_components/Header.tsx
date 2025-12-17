// app/boop/mini-v2/_components/Header.tsx
import { V2 } from "../_ui/theme";

export default function Header() {
  return (
    <div className="mb-5">
      <div className={V2.yellowTextStrong + " text-lg font-semibold"}>BoopApp</div>
      <div className={V2.subtitle}>Miniapp • Engage • Earn</div>
    </div>
  );
}
