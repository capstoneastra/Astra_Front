import { apiConfig } from "../api/config";
import { ApiError } from "../api/errors";
import type { User } from "./authService";
async function demo() {
  if (import.meta.env.DEV || (import.meta.env.MODE === "public-demo" && import.meta.env.VITE_PUBLIC_DEMO === "true")) {
    if (apiConfig.isMock) return import("../demo/payments");
  }
  throw new ApiError("결제 API 연결 대기 중입니다.", { code: "PAYMENT_UNAVAILABLE" });
}
export const paymentService = {
  read: async (id: number, user: User) => (await demo()).readPayment(id, user),
  approve: async (id: number, user: User, amount: number, fail = false) => (await demo()).approveDemoPayment(id, user, amount, fail),
};
