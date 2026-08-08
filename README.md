# SetFlow

SetFlow 是一款本地优先的 Android 健身辅助应用，面向个人与少量朋友体验。它把训练执行整理成一条清晰路径：选择今日计划、完成一组、自动休息提醒、继续下一组。

当前是早期体验版。训练计划、进度和记录保存在设备本地，不需要账号，也不依赖云端服务。

## 下载体验

- [下载最新 Android APK](https://github.com/li1408/SetFlow/releases/latest)
- [提交问题或体验反馈](https://github.com/li1408/SetFlow/issues)

下载 Release 中的 `SetFlow-v0.1.1-android-universal-debug.apk` 后安装即可。Android 可能要求允许浏览器或文件管理器“安装未知应用”。该 APK 使用调试签名，只适合小范围体验，不用于应用商店发布。

优先验证设备为小米 15。其他 Android 设备也可以安装测试，欢迎在反馈中附上设备型号、Android/HyperOS 版本和复现步骤。

## 当前能力

- 根据训练天数、时长、经验和器械离线生成计划
- 生成后编辑，以及完全手动创建训练计划
- 多训练日选择与本地训练进度恢复
- 逐组训练、休息倒计时、`±15 秒` 和跳过休息
- Android 本地通知与震动提醒
- 训练完成总结

跑步、饮食和社交暂不在当前版本范围内。

## v0.1.1 验证状态

- 修复软键盘弹出时训练天数输入框可能失焦的问题
- 93 项自动化测试通过
- 类型检查、ESLint 和生产构建通过
- Chrome 手机尺寸回归流程通过，无控制台警告或错误
- Android APK 构建、签名、ZipAlign 与合并清单检查通过
- 目标 API 36，最低 API 24

真机体验反馈仍是本次公开测试的重点。

## 本地开发

需要 Node.js 22.12 或更高版本。

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

完整回归：

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Windows 调试 APK 可通过 `npm run android:debug` 构建。项目内脚本默认读取 `E:\Tools\SetFlowAndroid`，也可以通过 `SETFLOW_ANDROID_TOOLS` 指定兼容的工具目录。

## 项目文档

- [产品与技术规格](docs/product-spec.md)
- [实施计划](docs/implementation-plan.md)
- [任务清单](docs/tasks.md)
- [参考项目审计](docs/reference-audit.md)
- [版本变更记录](CHANGELOG.md)

## 许可

当前仓库公开用于体验、反馈和协作查看，暂未授予开源许可证。
