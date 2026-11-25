import { PageHeader } from "./ui/index";
import QuickSimulation from "./simulation/QuickSimulation";
import "../styles/quick-sim.css";

/**
 * 가상 시뮬레이션 (v9)
 * 3D 시뮬레이션은 구현하지 않기로 해 삭제했고, 단계별 간이 계산만 남겼습니다.
 */
export default function Simulation({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  return (
    <div className="content-page page-enter simulation-page">
      <PageHeader title="가상 시뮬레이션" />
      <QuickSimulation setActiveMenu={setActiveMenu} />
    </div>
  );
}
