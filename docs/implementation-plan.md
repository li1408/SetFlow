# SetFlow MVP 实施计划

状态：**已确认，执行中**

本计划以 [产品与技术规格](product-spec.md) 为约束，任何新增范围先回到规格确认。

## 阶段 0：规格与工程基线

产物：

- 产品规格、实施计划、任务清单与参考审计。
- 独立 Git 仓库、明确的源码边界和版本策略。

退出条件：用户已确认规格并指定小米 15 为主验收设备。

## 阶段 1：可运行骨架与领域测试

先写失败测试，再实现：

- Vite + React + TypeScript + Capacitor 基础工程。
- 训练状态机、组完成规则、休息计时运算。
- 规则生成器的确定性、器械过滤、时长预算。
- 计划与历史快照的数据类型和 Zod 边界。

退出条件：领域测试、类型检查与生产构建通过；提交一个原子 commit。

## 阶段 2：本地持久化

先写失败测试，再实现：

- Dexie schema、Repository 接口和版本迁移。
- 完成组与开始休息的单事务写入。
- 进行中训练恢复、幂等到期处理。
- 计划更新不影响训练快照。

退出条件：数据库重开、迁移、失败回滚和恢复测试通过；提交一个原子 commit。

## 阶段 3：计划创建与今日首页

- 内置原创徒手动作库和少量器械动作。
- 规则生成向导、结果预览和编辑器。
- 手动计划编辑器。
- 今日首页、休息日、开始/继续训练。

退出条件：组件测试与浏览器主流程通过；刷新/重开后计划仍在；提交一个原子 commit。

## 阶段 4：训练执行与休息计时

- 独立训练执行页。
- 实际次数、时长和重量编辑。
- 完成本组、休息状态、`±15 秒`、跳过、下一组和总结。
- 前台音效与触感反馈适配器。

退出条件：从开始到完成可离线跑通；后台恢复不会产生重复组或重复计时器；提交一个原子 commit。

## 阶段 5：Android 原生能力与工具链

- 在 `E:\Tools\SetFlowAndroid` 安装隔离的完整 JDK 与 Android SDK。
- 初始化 Capacitor Android 工程。
- 通知权限、精确提醒能力检查、通知频道、调度/取消/重排。
- 禁用系统云备份、清理生产权限、限制 WebView 导航。
- 构建并安装调试 APK。

退出条件：在至少一台目标真机验证前台、后台、锁屏和熄屏提醒；提交一个原子 commit。

## 阶段 6：GSAP 视觉优化与可访问性

- 设计 token、移动布局、单手主操作区。
- `useGSAP()`、作用域清理、timeline、matchMedia 与 reduced-motion。
- 完成组反馈、训练/休息转场和完成反馈。
- 焦点、语义、状态播报、对比度、触控目标。

退出条件：多尺寸浏览器检查、减少动效检查、控制台与网络检查均通过；提交一个原子 commit。

## 阶段 7：回归与交付

- 全量单元/组件/迁移测试。
- 浏览器真实运行检查与截图审阅。
- Android Debug 构建、安装、冷启动、离线、升级保留数据测试。
- 输出 APK、SHA-256、安装方法和已知限制。
- 独立代码质量与安全复核；只修复与本次范围相关的问题。

退出条件：规格中的 P0 验收全部通过，无未说明阻塞。

## 提交策略

每个阶段只提交一个已通过对应验证的最小闭环；不混入 `E:\AI` 其他项目。建议提交序列：

```text
docs: draft SetFlow MVP specification
chore: scaffold local-first Capacitor app
feat: add deterministic workout planning domain
feat: persist plans and workout snapshots locally
feat: add plan builder and today workflow
feat: add recoverable workout rest timer
feat: add Android rest notifications
feat: apply GSAP motion system and accessibility
test: verify APK release candidate
```

## 失败与回退原则

- 工具链下载失败不阻断前端实现，但 APK 验收保持未完成。
- 原生精确提醒权限不可用时，应用显示明确降级状态；不声称后台准时。
- 动画或音效异常时可关闭对应适配器，核心状态机与数据不可依赖它们。
- 任何迁移测试失败都停止升级交付，不以清空用户数据作为修复手段。
