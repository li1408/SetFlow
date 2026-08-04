# SetFlow MVP 产品与技术规格

状态：**已确认，进入实现**

版本：0.1

日期：2026-08-04

## 1. 产品目标

为个人及少量朋友提供一个无需账号、无需联网、可侧载安装的 Android 健身辅助应用。首版聚焦居家徒手训练，同时允许添加哑铃等器械动作。

核心体验只有一条主线：

> 打开今日训练 → 看当前动作与目标 → 一键完成本组 → 自动开始组间休息 → 锁屏/后台收到提醒 → 继续下一组 → 保存训练历史。

首版借鉴 Workout.cool 的“计划转训练流程”思路，但不复制其品牌、视觉资产、动作数据或服务端代码。界面与动效为独立实现。

## 2. 已确认的用户需求

- 平台：Android APK，侧载安装，不上应用商店。
- 用户：主要自己使用，可能分享给少量朋友。
- 数据：默认仅保存在设备本地；首版无登录、无服务器、无云同步。
- 计划：支持手动创建，也支持离线规则生成；生成后可编辑。
- 生成输入：训练目标、每周天数、经验水平、可用器械、单次训练时长。
- 动作范围：居家徒手优先，同时支持健身房器械/附加重量。
- 执行流程：完成一组后自动进入组间休息；默认休息时间按动作设置。
- 快捷操作：休息时间 `-15 秒`、`+15 秒`、跳过。
- 提醒：前台有声音与振动；后台/锁屏依赖 Android 原生系统通知。
- 记录：允许修改本组实际次数与附加重量，计划目标与实际结果分开保存。
- 后续再做：跑步、饮食、社交、云同步、AI 计划生成。
- 设计：首版使用 GSAP 官方技能优化动效；用户后续提供新的设计 skill 时再做视觉升级。

## 3. 首版页面与主流程

### 3.1 首次进入

1. 选择“生成计划”或“手动创建”。
2. 生成计划时填写目标、天数、经验、器械和时长。
3. 预览生成结果，可替换动作、调整顺序、组数、目标量和休息时长。
4. 保存为当前启用计划。
5. 首次开始训练前进行通知、精确提醒与振动能力检查。

### 3.2 首页

- 显示今天的计划、预计时长、动作数量和上次训练摘要。
- 主按钮为“开始训练”或“继续训练”。
- 休息日明确显示，不自动把错过的训练补排到当天。
- 首版同时只允许一个启用计划、一个进行中的训练。

### 3.3 训练执行页

- 只展示执行所需信息，不混入完整计划编辑器。
- 显示当前动作、动作提示、当前组/总组数、目标次数或时长、附加重量。
- 用户可先修正实际次数/重量，再点击大按钮“完成本组”。
- 完成本组后，以一次数据库事务保存结果并创建休息计时器。
- 最后一组完成后进入下一动作；最后一个动作完成后进入训练总结。

### 3.4 休息页/休息状态

- 大号剩余时间、圆形进度、下一组预览。
- 操作：`-15 秒`、`+15 秒`、`跳过休息`。
- 修改休息时间必须同步取消并重排原生通知。
- 任意时刻最多存在一个活动休息计时器。
- GSAP 只渲染状态变化，不能推进业务状态或决定计时是否结束。

### 3.5 训练总结与历史

- 显示完成动作数、组数、训练时长和实际记录。
- 保存为不可变的训练快照。
- 后续编辑或删除计划，不得改写已完成训练的内容。

## 4. 规则生成器合同

规则生成器为确定性离线算法，不调用 AI 或网络。

输入：

- 目标：综合体能、力量、增肌、肌耐力。
- 每周天数：2–6 天。
- 经验：入门、基础、进阶。
- 器械：无器械、瑜伽垫、弹力带、哑铃、壶铃、单杠等，可多选。
- 单次时长：15–90 分钟。

输出要求：

- 同一规则版本与同一输入得到同一结果。
- 无器械时不得生成需要器械的动作。
- 每个动作必须包含组数、计量类型、目标量和默认休息时间。
- 计量类型首版仅为 `reps` 或 `durationSeconds`。
- 单侧动作明确标注“每侧”或“总计”。
- 输出计划完全可编辑。
- 首版不做伤病判断、医学建议、自动进阶或饮食建议。

## 5. 状态模型

训练状态：

```text
idle → active_set → resting → next_set_ready → active_set → completed
                      └──────── skip ──────────┘
```

关键不变量：

- 一次只能有一个 `active` 训练和一个 `active` 休息计时器。
- 完成本组、写入实际记录、推进训练位置、创建休息计时器必须原子提交。
- 原生通知在数据库事务成功后调度；若原生调用失败，计时器仍保留并标记为“提醒未就绪”，由启动/回前台时的协调器按通知 ID 幂等补排，绝不回滚已完成的组。
- 跳过休息必须取消尚未触发的系统通知。
- 应用从后台或进程回收后恢复时，根据持久化截止时间重建界面，而不是从旧的显示数字继续递减。
- 到期处理必须幂等，同一计时器最多完成一次。
- 手动修改系统时间可能影响首版计时；首版不把“用户主动改系统时间”作为保证场景。

## 6. 本地数据模型

所有实体使用稳定 UUID；动作名称不得充当关联键。

- `ExerciseDefinition`：内置/自建来源、名称、肌群、器械、计量类型、单侧语义、动作提示、默认休息。
- `Plan` / `PlanDay` / `PlannedExercise`：星期安排、顺序、组数、目标范围、默认休息、生成规则版本。
- `WorkoutSessionSnapshot`：开始训练时冻结的计划内容、当前状态、开始/结束时间。
- `PerformedSet`：计划目标与实际次数/时长/重量分开保存，可选备注。
- `ActiveRestTimer`：所属训练和组、开始时间、截止时间、通知 ID、调整量、状态、已处理标记。
- `AppSettings`：声音、振动、重量单位、减少动效偏好及最近一次能力检查结果。
- 所有可同步实体预留 `createdAt`、`updatedAt`、`schemaVersion`；以后加同步时不重做核心模型。

计划或动作删除采用逻辑边界，不级联删除历史快照。

## 7. Android 提醒与能力边界

### 7.1 实现原则

- 前台显示以持久化截止时间计算，`setInterval` 只负责刷新视图。
- 休息开始时使用 Capacitor Local Notifications 调度 Android 原生通知。
- Android 13+ 首次使用前请求通知权限。
- Android 12+ 检查精确提醒能力；未授权时明确提示并提供系统设置入口，不静默伪装成“已可靠开启”。
- 应用启动和每次回到前台时重新核对权限及待处理通知；权限被撤销造成系统删除闹钟时，协调器负责提示并在条件恢复后补排仍未到期的提醒。
- 创建专用的“组间休息”通知频道，配置声音与振动；用户的系统频道设置优先。
- `+/-15 秒` 取消旧通知并按新截止时间重排；跳过时取消通知。
- 前台到期增加应用内声音、振动与视觉反馈；后台由系统通知承担。

### 7.2 可承诺范围

在通知权限与精确提醒能力已授予、通知频道未静音、应用未被强制停止的测试设备上，锁屏、切后台或熄屏后，结束通知目标为在截止时刻后 2 秒内出现。

以下情况不能承诺声音/振动准时发生：系统勿扰、频道静音、硬件禁振、用户强制停止应用、Android 深度省电/Doze 限流、部分厂商额外省电限制。应用必须检测可检测的条件并清晰说明降级状态。

设备重启期间的活动休息提醒不作为首版验收场景；再次打开应用时训练位置仍应恢复。

## 8. 视觉与 GSAP 动效规范

- 原创、移动优先、竖屏优先、适合单手操作；主操作置于拇指易触区。
- 首版使用深石墨背景、温和的高可见度强调色与大号数字，避免复制 Workout.cool 外观。
- 动画使用官方 `gsap` 与 `@gsap/react`：组件内通过 `useGSAP()`、作用域 ref 和自动清理管理。
- 多步骤转场使用 `gsap.timeline()` 与标签；不得用串联延迟模拟时间线。
- 优先动画 `transform`、`opacity/autoAlpha`，不通过频繁改变布局属性制造动画。
- 使用 `gsap.matchMedia()` 同时处理窄屏和 `prefers-reduced-motion`。
- 减少动态效果时，训练状态、保存和通知行为必须完全一致。
- GSAP 不参与倒计时真相、数据保存、状态推进或通知触发。

首版重点动效：页面进入、完成一组确认、当前组切换、休息倒计时状态转场、训练完成反馈。装饰动画必须克制，不妨碍快速操作。

## 9. 技术架构

- 前端：React 19 + TypeScript + Vite。
- Android 容器：Capacitor 8，最低 API 24，目标 API 36。
- 持久化：Dexie/IndexedDB，通过 Repository 接口隔离，使用事务和显式 schema migration。
- 数据校验：Zod；导入、数据库读取与表单提交都经过边界校验。
- 动效：GSAP + `@gsap/react`。
- 原生能力：Capacitor Local Notifications、Haptics；生产包不依赖远程资源。
- 状态：领域状态机 + React Context/useReducer；计时器与持久化逻辑不放入展示组件。
- 测试：Vitest、React Testing Library、fake-indexeddb，以及真机后台/锁屏验收。

目录边界：

```text
src/
  app/                 # 应用壳、路由、依赖装配
  domain/              # 纯业务实体、状态机、规则生成器
  data/                # Dexie、Repository、迁移
  features/
    onboarding/
    plans/
    workout/
    history/
    settings/
  native/              # 通知、振动、生命周期适配器
  ui/                  # 通用组件、设计 token、GSAP 动效
  test/                # 测试夹具和浏览器环境
android/               # Capacitor 生成的 Android 工程
docs/
scripts/               # 项目本地开发/构建包装脚本
```

代码风格示例：业务决策返回明确结果，不在 UI 中混入副作用。

```ts
type CompleteSetResult =
  | { kind: "rest-started"; timerId: string; endsAt: number }
  | { kind: "next-exercise"; exerciseId: string }
  | { kind: "workout-completed"; sessionId: string };

async function completeSet(command: CompleteSetCommand): Promise<CompleteSetResult> {
  return workoutRepository.transaction(() => workoutDomain.completeSet(command));
}
```

## 10. 隐私与安全边界

始终执行：

- 训练数据只写入应用私有存储；生产 APK 禁用 Android 系统云备份。
- 生产 APK 不加载远程页面、远程字体、分析 SDK、广告或追踪器。
- 禁止 WebView 导航到任意站点，关闭明文网络与不必要的文件访问。
- 原生组件默认不导出；通知使用明确且不可变的 intent 配置。
- 不在日志中打印完整训练记录、备注或未来的身体数据。
- 数据库升级必须有迁移测试；应用升级保留历史。

实施前需用户确认：

- 安装完整 Android 构建工具链所需的较大下载。
- 创建正式发布签名密钥及其保管方式。
- 未来加入云同步、登录、联网视频、健康数据或社交功能。

首版明确接受：

- 手机 root、系统被攻破或设备已解锁后的攻击不在防护范围。
- 首版无云备份；卸载、清除应用数据或手机损坏后数据无法恢复。
- 首个交付为调试 APK；分享给朋友前再制作用户持有密钥的正式签名包。

## 11. 验收标准

### P0 核心

1. 全新安装后可离线生成或手动创建计划，关闭并重开应用后数据仍在。
2. 无器械输入不会生成器械动作；生成计划可编辑并保存。
3. 首页能开始/继续今天的训练；计划编辑与训练执行是不同页面。
4. 完成本组后实际次数/重量被保存，并自动进入该动作设置的休息时长。
5. `-15 秒`、`+15 秒`、跳过均正确更新状态与系统通知。
6. 切后台、锁屏或进程被系统回收后重开，仍恢复到同一训练和正确剩余时间。
7. 在声明的权限前提下，真机锁屏/熄屏提醒达到目标误差；权限不足时应用明确告知。
8. 编辑或删除原计划不改变已经开始或完成的训练快照。
9. 应用在减少动态效果下可完整训练，GSAP 动画中断不破坏业务状态。
10. `npm test`、`npm run build`、Android 单元测试和 `assembleDebug` 全部通过；APK 可通过 ADB 安装并离线启动。

### P1 质量

- 360×640 至常见大屏手机宽度无横向溢出；触控目标至少约 44 px。
- 键盘操作、可见焦点、颜色对比、屏幕阅读器标签和状态播报通过检查。
- 浏览器运行时无未处理异常、React 警告或资源 404。
- 生产包中无第三方远程请求，关键流程不依赖网络。

## 12. 明确不做

- iOS、应用商店发布、账号、云同步、多人协作。
- 跑步、饮食、社交、排行榜、AI 生成、医学/康复建议。
- 外部视频、Workout.cool 动作 CSV、品牌图像或未经授权素材。
- 首版自动训练进阶、穿戴设备、Health Connect。

## 13. 当前环境与阻塞

本机已有 Node 24、npm 11、pnpm 11 和两个可用 ADB，但没有完整 JDK、Android SDK、Build Tools 或 Android Platform。因此可以立即开发与验证前端，生成 APK 前必须补齐项目专用 Android 工具链。

建议将工具链放在 `E:\Tools\SetFlowAndroid`，通过项目脚本设置临时环境变量，不修改系统全局 PATH。该安装会有较大下载，需随本规格一并获准。

主验收设备为 **小米 15**。小米官方规格显示该机型出厂搭载 Xiaomi HyperOS 2；设备当前安装的 HyperOS/Android 版本将在连接 ADB 后直接读取。实现仍覆盖 Capacitor 支持范围 Android 7（API 24）及以上，最终以这台主手机的真机结果为准。

小米专项验收还包括：通知开关、精确提醒能力、应用电池策略设为“无限制”、后台自启动，以及锁屏/熄屏/从最近任务划走后的提醒表现。应用会提供设备引导，但不会尝试绕过用户的系统设置。

## 14. 固定验证命令

```powershell
npm install
npm run test
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1
npx cap sync android
.\android\gradlew.bat test
.\android\gradlew.bat assembleDebug
D:\adb-fastboot\adb.exe install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

预期 APK：

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## 15. 参考依据

- [Capacitor 8 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor Android](https://capacitorjs.com/docs/android)
- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Android 精确闹钟](https://developer.android.com/develop/background-work/services/alarms)
- [Android 通知权限](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Android 通知频道](https://developer.android.com/develop/ui/views/notifications/channels)
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup)
- [GSAP React 官方指南](https://gsap.com/resources/React/)
- [GSAP 官方 skills 仓库](https://github.com/greensock/gsap-skills)
- [小米 15 官方规格](https://www.mi.com/uk/product/xiaomi-15/specs/)
- [小米后台自启动说明](https://www.mi.com/global/support/faq/details/KA-507611/)
- [小米 15 后台电池策略说明](https://www.mi.com/global/support/faq/details/KA-538010/)

## 16. 批准方式

用户已确认先按本规格实现，并指定小米 15 为主验收设备。Android 工具链隔离安装于 `E:\Tools\SetFlowAndroid`，不修改系统全局 PATH；正式签名密钥仍在调试 APK 验收后另行确认。
