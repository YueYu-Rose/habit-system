/**
 * 外部待办/第三方网页 → 本系统的「假入口」
 *
 * 生产环境预期接入方式（择一或组合）：
 * 1) **HTTPS Webhook**：外部站点完成任务后，向 `POST /api/integrations/.../callback` 发送签名请求；
 *    由服务端校验签名后，写入队列并调用与 `handleExternalTaskComplete` 等效的业务层。
 * 2) **浏览器扩展 / UserScript**：在第三方页面监听 DOM/路由完成事件，发消息给本站的 `postMessage` 宿主页，
 *    或调用暴露的受控 `window` API（仅开发/内网、需 CORS/安全审核）。
 * 3) **轮询/Server-Sent Events**：本站定期向外部 API 拉取「已完成项」，与服务端对账后触发加分。
 *
 * 当前仅暴露 **全局方法** 与下方 **可注入的处理器**，供 Mock、单元测试、或将来桥接到真实 I/O。
 */

export type ExternalTaskCompletePayload = {
  /** 该任务与当前主线同主题时，自动触发双向 +分（与默认规则一致，如 10 分） */
  relatedToMainline: boolean;
  /** 可选，用于在 Toast/日志中区分任务来源，不参与计分 */
  sourceHint?: string;
  /** 覆盖默认 10 分；保持简单，通常固定 10 */
  pointsOverride?: number;
};

type Handler = (p: ExternalTaskCompletePayload) => void;

let handler: Handler | null = null;

/**
 * 由 `MainlineLoopProvider` 在应用启动时注册，将外部信号接入本地主线逻辑
 */
export function setExternalTaskCompleteHandler(h: Handler | null): void {
  handler = h;
}

/**
 * 供外部或控制台模拟调用：如 `handleExternalTaskComplete({ relatedToMainline: true })`
 */
export function handleExternalTaskComplete(payload: ExternalTaskCompletePayload): void {
  if (handler) {
    handler(payload);
    return;
  }
  if (import.meta.env.DEV) {
    console.warn(
      "[mainline] handleExternalTaskComplete: 无处理器（MainlineLoopProvider 未挂载？）",
      payload
    );
  }
}

/** 便于控制台 / 书签 / 外部脚本在开发时直接触发（勿在生产暴露敏感能力） */
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { handleExternalTaskComplete: typeof handleExternalTaskComplete }).handleExternalTaskComplete =
    handleExternalTaskComplete;
}
