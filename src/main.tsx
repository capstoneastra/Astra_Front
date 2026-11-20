import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/themes.css";
import "./styles/assistant.css";
import "./styles/workspace-updates.css";
import App from "./App";
import { initializeApi } from "./api/bootstrap";
import ApiState from "./components/ui/ApiState";
import { Panel } from "./components/ui/index";

const container = document.getElementById("root");
if (!container) throw new Error("ASTRA를 연결할 루트 요소가 없습니다.");
const root = createRoot(container);
initializeApi()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="main-content">
        <Panel>
          <ApiState
            error={{
              message:
                "API 환경을 시작하지 못했습니다. Mock 모드에서는 /api/v1 주소와 Service Worker 실행 가능 여부를 확인해주세요.",
            }}
            onRetry={() => window.location.reload()}
          />
        </Panel>
      </main>,
    ),
  );
