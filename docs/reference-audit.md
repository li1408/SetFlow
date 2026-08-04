# Workout.cool 参考审计

审计基线：`Snouzy/workout-cool` 主分支提交 `e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8`（2026-07-31）。

## 结论

SetFlow 应新建 React + Vite + TypeScript + Capacitor 应用，不直接 fork Workout.cool。

Workout.cool 是 Next.js + Prisma/PostgreSQL + Better Auth 的完整 Web 平台，并包含支付、订阅、广告、分析、邮件和后台能力。它没有 Capacitor/Android 工程，也没有我们需要的原生组间休息提醒。为本地 APK 裁剪这些服务端能力的成本和风险，高于新建一个边界清晰的本地优先应用。

## 可以借鉴的交互思路

- 器械 → 肌群 → 动作的生成、替换与排序。
- suggested sets 转成可编辑训练记录。
- 一键完成组，并允许事后修正。
- 当前动作导航、自动定位、动作说明。
- 声音、振动与完成反馈。
- `active/completed/synced` 的本地优先状态概念。

## 不复制的内容

- 品牌、Logo、人物、赞助图和视觉外观。
- 外部 YouTube 视频、缩略图与示例动作 CSV。
- 广告、支付、账号、服务端和同步代码。
- 未清理即渲染动作 HTML 的方式。
- 把计划编辑与训练执行混在同一屏的结构。

## 核对依据

- [MIT License](https://github.com/Snouzy/workout-cool/blob/e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8/LICENSE)：允许使用、修改和分发；若复制实质代码须保留版权与许可证文本。
- [PWA service worker](https://github.com/Snouzy/workout-cool/blob/e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8/public/sw.js#L22-L42)：仅缓存图标，业务请求仍为 network-only。
- [现有 Timer](https://github.com/Snouzy/workout-cool/blob/e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8/src/components/ui/timer.tsx#L19-L35)：前台训练总时长正计时，不是组间休息倒计时。
- [完成一组逻辑](https://github.com/Snouzy/workout-cool/blob/e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8/src/features/workout-session/model/workout-session.store.ts#L268-L284)：没有创建后台休息通知。
- [本地历史](https://github.com/Snouzy/workout-cool/blob/e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8/src/shared/lib/workout-session/workout-session.local.ts#L3-L16)：只保留最近 10 次，不适合长期个人记录。
- [Issue #79](https://github.com/Snouzy/workout-cool/issues/79)：公开提出独立执行界面和内置休息钟，当前仍未完成。

本项目只借鉴公开的产品流程，不复制原仓库代码，因此当前不需要引入其 MIT 版权文本。若后续确实复用任何实质代码，再逐文件记录来源并补充许可证声明。
