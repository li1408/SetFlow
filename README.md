# SetFlow

SetFlow 是一款面向个人与少量朋友使用的 Android 本地健身辅助应用。它把训练执行压缩成一条清晰路径：打开今日计划、完成一组、自动休息提醒、继续下一组。

当前 MVP 已完成可运行的 Web/Capacitor 主体：离线规则生成与生成后编辑、手动计划编辑、多训练日选择、本地恢复、逐组训练、绝对截止时间休息计时、`±15 秒`、跳过、训练总结，以及 Android 原生通知/震动适配层。主验收设备为小米 15；实际 HyperOS/Android 版本将在真机连接后读取。

## 当前验证状态

- `npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 已通过。
- Google Chrome 已跑通规则计划编辑、多训练日、手动计划、训练恢复与完成流程；新加载无页面异常或外部 HTTP 请求。
- 400×890 和 320×568 视口无横向溢出；支持 `prefers-reduced-motion`。
- Capacitor Android 工程已生成并加固，目标 API 36、最低 API 24。
- APK 尚未生成：Android SDK 许可必须由用户本人确认，之后才能安装 SDK Platform/Build Tools 并执行真机构建。

## 本地运行

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

完整回归：

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Android SDK 安装完成后，`npm run android:debug` 会使用隔离在 `E:\Tools\SetFlowAndroid` 的 JDK 21、Gradle 8.14.3 和 SDK 构建调试 APK，并输出 SHA-256。

## 规格入口

- [产品与技术规格](docs/product-spec.md)
- [实施计划](docs/implementation-plan.md)
- [任务清单](docs/tasks.md)
- [Workout.cool 参考审计](docs/reference-audit.md)

临时工作名为 **SetFlow**，后续可整体改名，不会写死在业务数据中。
