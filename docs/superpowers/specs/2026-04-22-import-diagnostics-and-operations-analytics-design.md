# 日志清洗、严格诊断与运营分析联动设计

## 背景

当前项目已经具备基础的数据导入、清洗摘要和运营分析页面，但面对真实完整日志时，仍然存在三类核心问题：

- 导入页更像“上传工具”，不是“数据质量入口”
- 清洗逻辑已经能处理部分原始导出格式，但缺少一层严格对照事件方案的诊断
- 运营分析虽然已经有模块化看板，但图表与数据风险之间的关系还不够清楚

这次需求的真实输入有两份：

- 原始日志：[raw (3).csv](/Users/fulei/Downloads/raw%20(3).csv)
- 事件方案参考：[Screw Fun 打点事件日志 (6).xlsx](/Users/fulei/Downloads/Screw%20Fun%20%E6%89%93%E7%82%B9%E4%BA%8B%E4%BB%B6%E6%97%A5%E5%BF%97%20(6).xlsx)

对 `raw (3).csv` 的初步确认如下：

- 编码为 `gb18030`
- 分隔符为 `;`
- 为 AppsFlyer 风格原始导出
- 含 `event_value` 与 `custom_data` 等嵌套 JSON 字段
- 已确认出现的核心事件包括：
  - `tutorial_step`
  - `tutorial_begin`
  - `tutoriallevel_start`
  - `af_tutorial_completion`
  - `level_start`
  - `camera_rotate`
  - `screw_interact`
  - `item_use`
  - `af_ad_view`
  - `app_start`

对事件方案表的初步确认如下：

- 包含 `Readme + 8 个业务模块 + 1 个公共属性表`
- 本轮严格校验范围先收敛为 5 块：
  - 公共属性
  - 新手引导
  - 关卡与局内行为
  - 广告分析
  - 商业化
- 其余模块本轮只做缺失提示，不阻断分析

## 目标

本轮设计目标如下：

1. 数据导入支持对 `raw (3).csv` 完成稳定清洗，产出标准化业务行数据。
2. 导入阶段增加严格诊断，按事件方案对 5 个核心模块做结构验收。
3. 业务失败事件不再算作导入失败，导入页明确区分技术问题与业务结果。
4. 导入页可以直接预览清洗后的数据，而不只看摘要。
5. 运营分析改为明确消费：
   - `cleanedRows`
   - `diagnostics`
   - 模块专用聚合结果
6. 新手引导、关卡与局内行为、广告分析、商业化四个模块优先基于真实导入数据出图。
7. 图表必须带着风险上下文展示，而不是默认假设日志完全正确。

## 不在本轮范围内

以下内容不在本轮首批实现范围：

- 资源产销、活动、社交等模块的深度专项看板
- AI 报告页面重构
- 重新设计整套方案中心
- 对原始 CSV 的“任意格式智能理解”，本轮优先围绕当前确认的 AppsFlyer 导出结构
- 每次导入时动态读取 Excel 表并做全动态规则引擎

## 核心原则

### 原则 1：严格校验的是“清洗后标准字段”，不是原始列名

原始日志的列名、编码和别名可能不统一，因此严格诊断不能直接拿原始列名和事件方案 Excel 硬比。系统应先完成：

- 编码识别
- 分隔符识别
- `event_value/custom_data` 展开
- 事件名归一化
- 字段映射归一

再用清洗后的标准字段与事件方案做对照。

### 原则 2：业务失败不等于导入失败

以下情况属于业务结果，不应压低技术导入通过率：

- `level_fail`
- `tutorial_step_fail`
- `result=fail/error`
- 广告点击后未发奖
- 下单后支付失败

真正影响导入质量的是：

- 编码/解析失败
- 关键字段缺失
- 关键事件缺失
- 结构无法形成对应模块的分析口径

### 原则 3：有风险也允许继续分析

本轮采用“允许导入成功，但显式标红”的策略。

诊断等级定义如下：

- `通过`
  - 5 个核心模块都可分析，仅有轻微 warning
- `高风险`
  - 至少 1 个核心模块存在明显缺口，但还能出图
- `严重缺口`
  - 至少 1 个核心模块缺少关键事件或关键字段，图仍可打开，但必须优先展示诊断

## 标准化清洗层设计

### 输入

- 原始上传日志文件
- 用户确认后的字段映射
- 当前项目、方案版本上下文

### 输出

标准化后的 `cleanedRows`，每一行尽量统一抽出以下字段：

- `event_name`
- `event_time`
- `user_id`
- `platform`
- `app_version`
- `country_code`
- `level_id`
- `level_type`
- `step_id`
- `step_name`
- `result`
- `fail_reason`
- `duration_sec`
- `placement`
- `price`
- `reward_type`
- `activity_id`
- `activity_type`
- `gain_source`
- `gain_amount`
- `resource_type`
- `extra`

### 原始日志解析要求

系统必须具备：

1. 编码识别
   - 优先尝试 `utf-8-sig`
   - 失败后尝试 `utf-8`
   - 再尝试 `gb18030`
2. 分隔符识别
   - 当前主路径为分号分隔 `;`
3. JSON 字段展开
   - 自动展开 `event_value`
   - 自动展开 `custom_data`
4. 数值字段兼容
   - 兼容 `1,331771` 这类逗号小数格式
5. 空对象与空字符串处理
   - `{}` 与空字符串都应当被识别为“无附加字段”，而不是解析异常

### 事件归一化要求

至少覆盖以下归一化：

- `af_tutorial_completion -> tutorial_complete`
- `tutoriallevel_start -> tutorial_level_start`
- `af_level_achieved -> level_complete`
- `af_ad_view -> ad_impression`
- `af_ad_click -> ad_click`
- `af_initiated_checkout -> iap_order_create`
- `af_purchase -> iap_success`

如果原始日志中没有命中明确规则，则保留归一化后的 snake_case 名称，并标记是否为“未标准命中”。

## 严格诊断层设计

### 输出结构

诊断结果建议结构如下：

- `overallStatus`
- `technicalSuccessRate`
- `technicalErrorCount`
- `businessFailureCount`
- `moduleCoverage`
- `moduleChecks`
- `issues`
- `coverage`

其中每条 issue 至少包含：

- `severity`
  - `info`
  - `warning`
  - `error`
- `code`
  - `missing_event`
  - `missing_field`
  - `invalid_value`
  - `coverage_gap`
  - `incomplete_chain`
  - `alias_only`
- `module`
- `target`
- `message`
- `suggestion`

### 公共属性严格校验

必须稳定识别以下标准字段：

- `event_name`
- `event_time`
- `user_id`
- `platform`
- `app_version`
- `country_code`

规则：

- 缺 `event_time` 或 `user_id`，记 `error`
- 缺 `platform / app_version / country_code`，记 `warning`
- 字段存在但空值率过高，记 `warning`

### 新手引导严格校验

必须识别：

- `tutorial_begin`
- `tutorial_step`
- `tutorial_complete` 或等价事件

其中 `tutorial_step` 必须带：

- `step_id`
- `step_name`

规则：

- 只有步骤事件但没有开始或完成事件，记 `error`
- `tutorial_step` 有记录，但 `step_id / step_name` 缺失率高，记 `error`
- 步骤链路只能部分形成，记 `warning`

### 关卡与局内行为严格校验

关卡主漏斗必须识别：

- `level_start`
- `level_complete`
- `level_fail`

并至少拿到：

- `level_id`

局内行为优先识别：

- `camera_rotate`
- `screw_interact`
- `item_use`
- `unlock_extra_slot`

规则：

- `level_start` 有，但 `complete/fail` 极少或缺失，记 `error`
- `retry` 缺失，记 `warning`
- 完全没有局内行为事件，记 `warning`
- 局内行为存在但无法关联 `level_id`，记 `error`

### 广告分析严格校验

至少识别：

- `ad_impression`
- `ad_click`
- `ad_reward_claim`

关键字段：

- `placement`

规则：

- 广告事件存在，但 `placement` 大量为空，记 `error`
- 只有曝光，没有点击/发奖，记 `warning`
- 缺 `request` 不算导入失败，但记 `warning`
- 页面必须说明“当前广告请求量缺失，仅展示曝光/点击/发奖链路”

### 商业化严格校验

至少识别：

- `iap_order_create`
- `iap_success`

优先抽取：

- `price`
- `currency`
- `item_name / reward_id / sku`
- `trigger_scene`

规则：

- 只有支付成功，没有下单事件，记 `warning`
- 价格字段大量缺失，记 `warning`
- 既没有商品标识也没有场景标识，记 `error`
- 商店曝光链路缺失但支付链路存在，允许分析支付漏斗，但商店漏斗记高风险

## 导入页设计

数据导入页重构为结果导向的 4 段式结构。

### 1. 导入总状态区

顶部直接展示：

- `通过 / 高风险 / 严重缺口`
- 技术通过率
- 业务失败事件数
- 可分析模块覆盖率
- 未匹配事件数

主文案：

> 这批日志已经完成清洗与严格校验。即使存在业务埋点缺口，也可以继续进入运营分析，但系统会明确标记结论风险。

### 2. 清洗结果预览区

应展示：

- 编码识别结果
- 分隔符识别结果
- 已展开字段说明
- 事件归一化说明

并提供清洗后预览表，优先展示：

- `event_name`
- `event_time`
- `user_id`
- `level_id`
- `step_id`
- `step_name`
- `placement`
- `price`
- `result`
- `fail_reason`

支持按以下维度过滤：

- 模块
- 事件名
- 风险等级

### 3. 严格诊断结果区

应包含两层：

1. 模块诊断卡
   - 公共属性
   - 新手引导
   - 关卡与局内行为
   - 广告分析
   - 商业化
2. 问题清单
   - 缺事件
   - 缺字段
   - 值异常
   - 链路不完整

模块卡显示：

- 当前状态
- 缺失事件数
- 缺失字段数
- 是否可进入分析

点击模块卡后，下方问题清单只看对应模块。

### 4. 后续动作区

固定动作：

- `查看清洗预览`
- `查看完整诊断`
- `进入运营分析`

当模块为高风险或严重缺口时：

- 不阻断进入运营分析
- 但按钮旁边明确说明“将带着风险提示进入分析”

### 导入页交互规则

- 点击某条诊断项后，应尽量定位到清洗预览中的对应行或对应事件集
- 每个问题项要同时给出：
  - 发现了什么
  - 为什么影响分析
  - 建议怎么修

## 运营分析页设计

四个核心模块统一遵循：

1. 数据风险条
2. 关键结论卡
3. 主图
4. 趋势/构成图
5. 明细表
6. 诊断补充说明

### 新手引导

主图：

- `步骤漏斗图`

辅图：

- `步骤完成率曲线`
- `步骤耗时排行`

明细表：

- `step_id`
- `step_name`
- 到达数
- 完成数
- 完成率
- 流失数
- 平均耗时
- 风险标记

风险联动：

- 缺 `step_id/step_name` 时仍允许出图
- 顶部红条明确提示“漏斗可信度不足”

### 关卡与局内行为

主图：

- `关卡漏斗对比图`
  - `start / complete / fail / retry`

辅图：

- `失败原因分布`
- `重试排行`

下半区：

- `局内行为分析`
  - 各关卡行为占比
  - 高频操作排行
  - 行为耗时

明细表分两段：

- 关卡明细
- 行为明细

风险联动：

- 缺 `level_id` 时直接标 `严重缺口`
- 行为事件无法关联关卡时提示“行为数据孤立”

### 广告分析

主图：

- `广告位链路图`
  - `impression/play -> click -> reward`

辅图：

- 广告位排行
- 广告位构成

明细表：

- 广告位
- 曝光/播放
- 点击
- 发奖
- 点击率
- 发奖率
- 风险说明

风险联动：

- `placement` 缺失率高时标红
- 没有 `request` 时明确说明“请求量缺失，本图从曝光开始”

### 商业化

主图：

- `双漏斗`
  - 商店/礼包曝光 -> 点击 -> 下单 -> 成功
  - 支付请求 -> 下单 -> 成功

辅图：

- 商店计费点分布
- 礼包分布

明细表：

- 计费点/礼包
- 曝光
- 点击
- 下单
- 成功
- 成功率
- 风险说明

风险联动：

- 只有支付成功没有下单时，标“链路前段缺失”
- 缺金额或商品标识时，标“收入明细可信度不足”

## 数据层结构设计

本轮建议把数据处理拆成 3 层，而不是继续只扩展一个大 summary。

### 清洗层

输入：

- 原始 CSV
- 映射配置

输出：

- `cleanedRows`

职责：

- 编码识别
- 分隔符解析
- JSON 展开
- 事件归一化
- 时间和数字清洗

### 诊断层

输入：

- `cleanedRows`
- 事件方案规则

输出：

- `diagnostics`

职责：

- 严格校验 5 个核心模块
- 输出总状态、模块状态、问题清单、覆盖率

### 分析层

输入：

- `cleanedRows`
- `diagnostics`

输出：

- `onboardingAnalysis`
- `levelAnalysis`
- `adsAnalysis`
- `monetizationAnalysis`

职责：

- 生成模块专用聚合结果
- 把风险上下文传递到图表与明细

## API 与持久化建议

本轮建议导入批次至少保存：

- `rawHeaders`
- `fieldMappings`
- `summaryJson`
- `cleanedRows`
- `diagnostics`

建议新增或扩展：

- 导入结果读取接口返回清洗后的预览与诊断
- 运营分析接口优先读取：
  - 最近导入批次
  - 对应 `cleanedRows`
  - 对应 `diagnostics`

## 实施顺序

建议按以下顺序落地：

1. 完善 `raw (3).csv` 的清洗兼容
   - 编码
   - 分号分隔
   - JSON 展开
   - 数值/时间清洗
2. 引入严格诊断结构
3. 导入页展示总状态、清洗预览、诊断结果
4. 运营分析四模块改为消费 `cleanedRows + diagnostics`
5. 把模块风险条与明细说明补上
6. 用真实日志做端到端验收

## 验收标准

### 清洗正确

- `raw (3).csv` 能识别为 `gb18030 + ;`
- `event_value/custom_data` 能正确展开
- 关键事件能按规则归一化

### 诊断正确

- 公共属性、新手引导、关卡与局内行为、广告、商业化能严格校验
- 其余模块仅提示缺失，不阻断
- 业务失败事件不被当作技术导入失败

### 导入页可用

- 能看到导入总状态
- 能预览清洗后的数据
- 能查看严格诊断清单
- 能从问题项定位到对应预览数据

### 运营分析可用

- 新手引导能展示步骤漏斗与最大流失步骤
- 关卡与局内行为能展示关卡漏斗、失败原因、重试和行为占比
- 广告分析能展示广告位链路
- 商业化能展示双漏斗和礼包/计费点分布
- 每个模块都能明确展示当前数据风险

## 设计结论

本轮不再把“日志上传”和“运营分析”看成两个松散页面，而是把它们收成一条完整链路：

1. 上传原始日志
2. 生成标准化清洗数据
3. 按事件方案做严格诊断
4. 在导入页明确展示风险和预览
5. 在运营分析页基于真实数据出图，并显式携带风险上下文

这样系统输出的不再只是“看起来能用的图表”，而是“带有可信度说明的分析结果”。
