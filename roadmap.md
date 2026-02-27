# DSL Evolution Engine — Roadmap (v3)

> Framework 和 Use Case 从第一天就分离。框架定义"学习如何发生"，用例定义"学什么"。

---

## 结构约定

每项工作标注归属：

- **🔧 Framework** → `packages/evolution/`
- **📊 Use Case (BI)** → `packages/bi/`
- **🚀 App** → `apps/evolution/`
- **📓 Knowledge** → `knowledge/`

依赖关系：`packages/bi` → `packages/evolution`（只依赖导出的类型和接口）。`apps/evolution` 组装两者。

---

## Phase 0：基座搭建（4 周）

### 第 1 周：核心类型与项目骨架

**🔧 Framework — `packages/evolution/src/types/`**

- turborepo + TypeScript monorepo 初始化
- 核心类型定义：
  - `schema.ts`：Schema, CandidateSchema, Extension, Rule
  - `instance.ts`：Instance, CandidateInstance, Payload
  - `demonstration.ts`：Demonstration, Behavior, OpaqueSource
  - `gap.ts`：Gap, Severity, Discrepancy
  - `runtime.ts`：RuntimeCapability, Feature, Supportability
  - `compile.ts`：Executable, CompileResult, Constraint
  - `memory.ts`：Memory, EvolutionRecord
  - `pipeline.ts`：PipelineResult, Stage, ConvergenceConfig
  - `errors.ts`：所有错误类型

**🔧 Framework — `packages/evolution/src/adapter.ts`**

- 定义 DomainAdapter 接口：

```typescript
interface DomainAdapter {
  compile:     (instance: Instance) => Either<CompileError, Executable>
  compileC:    (candidate: CandidateInstance) => CompileResult
  execute:     (executable: Executable) => Either<ExecuteError, Behavior>
  fingerprint: (raw: unknown) => Behavior
  runtime:     () => RuntimeCapability
}
```

**📓 Knowledge**

- 建立 `knowledge/` 目录结构
- `knowledge/decisions/000-design-philosophy.md`
- `knowledge/decisions/001-framework-usecase-separation.md`

### 第 2 周：确定性管线（框架侧）

**🔧 Framework — `packages/evolution/src/`**

- `validator.ts`：Schema + Instance → 校验（纯逻辑，不涉及任何领域）
- `comparator.ts`：Behavior × Behavior → Gap（基于结构化 diff，不涉及任何领域）
- `schema-registry.ts`：最小版本——load, promote, rollback
- 测试：`tests/framework/`，用 mock 数据，不依赖 BI 概念

### 第 3 周：BI 领域适配器

**📊 Use Case — `packages/bi/src/`**

- `adapter.ts`：实现 DomainAdapter 接口
  - `compile`：Instance → ECharts Option
  - `execute`：ECharts Option → 沙箱运行
  - `fingerprint`：运行结果 → 行为指纹（API 请求序列 + 渲染属性快照）
  - `runtime`：当前渲染引擎的能力声明
- 手写第一版 Schema：柱状图 + 折线图 + 基础筛选器
  - `knowledge/schema/v0.1.0/schema.json`
- 手写 5-10 个 Instance 样本
- 测试：`tests/bi/`，Instance → ECharts Option → 行为指纹，全链路跑通

### 第 4 周：parse 接入与 demo

**🔧 Framework — `packages/evolution/src/actions/`**

- `approximate.ts`：定义 Approximate 接口签名

**📊 Use Case — `packages/bi/src/`**

- `approximate.ts`：BI 特化的 parse prompt 策略（Schema 作为 system prompt，LLM 产出 JSON）

**🚀 App — `apps/evolution/src/`**

- `server.ts`：最小 API 服务，暴露 parse → compile → execute 端点
- `index.ts`：组装 `packages/evolution` + `packages/bi`，启动服务

**📓 Knowledge**

- `knowledge/decisions/002-bi-schema-v0.1.0.md`

**检查点**：团队里至少一个人能用它生成图表并觉得有用。

---

## Phase 1：单轨跑通（6 周）

### 第 5-6 周：Approximation 阶段

**🔧 Framework — `packages/evolution/src/pipelines/`**

- `approximation.ts`：
  - Approximate → Validate → Compile → Execute → Compare
  - 产出 `ApproxOutcome`：Sufficient | Insufficient(Gap)
- 这个管线只依赖 DomainAdapter 接口，不知道 BI 的存在

**📊 Use Case — `packages/bi/src/`**

- `fingerprint.ts`：定义 BI 行为指纹结构
  - API 指纹 = 指标 + 维度 + 筛选条件 + 排序
  - 渲染指纹 = 图表类型 + 系列配置 + 坐标轴
- 定义 Gap 严重等级的 BI 特化规则

**📓 Knowledge**

- `knowledge/rules/behavioral.md`：BI 场景下的行为比对规则

### 第 7-8 周：Extension 阶段

**🔧 Framework — `packages/evolution/src/`**

- `actions/extend.ts`：定义 Extend 接口签名
- `pipelines/extension.ts`：迭代循环，收敛控制，Blocked 反压
- `pipelines/codification.ts`：Promote 流程
- `reporter.ts`：自动生成 `knowledge/cases/NNN-xxx/` 目录

**📊 Use Case — `packages/bi/src/`**

- `extend.ts`：BI 特化的扩展 prompt 策略——给 LLM 当前 Schema + Gap 描述 + Pro Code 片段，产出 Schema 扩展建议

### 第 9-10 周：第一次真实进化

**📊 Use Case — `packages/bi/`**

- 选一个团队资深工程师最近写的 Pro Code（当前 Schema 不支持的图表类型）
- 跑完整 Evolution Pipeline

**🚀 App — `apps/evolution/`**

- 确保 `index.ts` 能编排完整 Evolution Pipeline（approximation → extension → codification）

**📓 Knowledge**

- 完整记录为 `knowledge/cases/001-xxx/`：
  - Approximation 阶段的 Gap 详情
  - Extension 阶段的迭代过程（每轮 Candidate 和 Gap 变化）
  - 失败点和原因分析（如果失败）
  - Schema diff（如果成功）

**检查点**：手里有至少 1 个成功案例 + 1 个失败案例。

---

## Phase 2：进化闭环（8 周）

### 第 11-12 周：自动触发

**🔧 Framework — `packages/evolution/src/`**

- `observer.ts`：定义 DemonstrationSource 接口

```typescript
interface DemonstrationSource {
  subscribe: (callback: (demo: Demonstration) => void) => void
}
```

- `queue.ts`：进化任务队列

**📊 Use Case — `packages/bi/src/`**

- `source.ts`：实现 DemonstrationSource——Git hook 监听 Pro Code 提交，解析为 Demonstration

**🚀 App — `apps/evolution/src/`**

- `daemon.ts`：后台进程，消费 DemonstrationSource，驱动 Pipeline

### 第 13-14 周：Runtime 约束

**🔧 Framework — `packages/evolution/src/pipelines/extension.ts`**

- CompileC 的三种返回路径（Compiled / Blocked / Degraded）的完整处理
- Blocked → constraintsToGap 的转换逻辑
- Degraded 时 RuntimeUpdateTask 的记录和输出

**📊 Use Case — `packages/bi/src/adapter.ts`**

- 完善 BI 渲染引擎的 RuntimeCapability 声明
- 测试：遇到不支持的渲染能力时，系统能正确识别并反馈

### 第 15-16 周：可视化与团队感知

**🚀 App — `apps/evolution/src/dashboard.ts`**

- 简单的 Web 页面：
  - Schema 版本时间线
  - 未解决的 NEEDS_HUMAN_REVIEW 列表
  - 进化成功率趋势
- 放到团队日常可见的地方

### 第 17-18 周：批量进化与案例积累

**📊 Use Case — `packages/bi/`**

- 回溯过去 3 个月的 Pro Code，挑选 10-15 个有代表性的，逐一跑 Evolution Pipeline

**📓 Knowledge**

- 对所有案例做分类标注：
  - 成功 / 失败
  - 失败阶段：A（Approximation）还是 B（Extension）
  - 失败原因类型：Schema 表达力不足 / Extend prompt 质量差 / Runtime 不支持 / 概念跨度太大
- 开始绘制**边界草图**：什么类型的知识容易学，什么类型总需要人

**检查点**：能画出初步的边界分类。

---

## Phase 3：抽象与输出（6 周）

### 第 19-20 周：框架定型

**🔧 Framework — `packages/evolution/`**

- 审视 `src/`，确认没有 BI 特定逻辑泄漏
- 完善 DomainAdapter 接口文档
- 完善 DemonstrationSource 接口文档
- 补充框架级别的测试：`tests/framework/`，用 mock adapter 跑完整管线
- 写 `packages/evolution/README.md`：如何为一个新领域实现 adapter

### 第 21-22 周：第二个领域绑定

**📊 Use Case — `packages/[second-domain]/`**

- 选一个场景（候选：表单配置 / 审批流编排 / 报表模板）
- 新建 `packages/[second-domain]/`，只实现 DomainAdapter + DemonstrationSource
- 不动 `packages/evolution/`
- 跑 2-3 个进化案例
- 记录：哪些地方框架够用，哪些地方需要回去改框架

**🔧 Framework（如果需要）**

- 根据第二领域的反馈修正框架抽象
- 每一次修正记录为 `knowledge/decisions/`

### 第 23-24 周：文章

**📓 Knowledge**

- 整理所有 `knowledge/cases/`，提取统计数据
- 按文章骨架撰写：

```
1. 问题：专家知识的困局（BI 前端的真实痛点 → 一般化）
2. 理论框架：三原语、核心张力、两阶段拆分、与 Piaget 的对应
3. 类型系统：Current/Candidate、确定性/非确定性隔离
4. 工程实现：项目结构、DomainAdapter 接口
5. 实验结果：N 个案例的边界分析
   - 能自动学的模式
   - 不能自动学的模式
   - 人的不可替代性的具体形态
6. 泛化验证：第二个领域的结果
7. 结论：人与 AI 的边界地图
```

---

## 工作量分布

```
           Framework 🔧    Use Case 📊    Knowledge 📓
Phase 0      60%             30%            10%
Phase 1      40%             45%            15%
Phase 2      15%             60%            25%
Phase 3      30%             30%            40%
```

---

## 路径与结构的映射

```
packages/evolution/src/              Phase 0-1 集中建设，Phase 2 收尾
├── types/                           Phase 0 第 1 周
├── adapter.ts                       Phase 0 第 1 周
├── validator.ts                     Phase 0 第 2 周
├── comparator.ts                    Phase 0 第 2 周
├── schema-registry.ts               Phase 0 第 2 周
├── actions/
│   ├── approximate.ts               Phase 0 第 4 周
│   └── extend.ts                    Phase 1 第 7 周
├── pipelines/
│   ├── approximation.ts             Phase 1 第 5 周
│   ├── extension.ts                 Phase 1 第 7 周
│   ├── codification.ts              Phase 1 第 8 周
│   └── evolution.ts                 Phase 1 第 9 周
├── observer.ts                      Phase 2 第 11 周
├── queue.ts                         Phase 2 第 11 周
└── reporter.ts                      Phase 1 第 8 周

packages/bi/src/                     Phase 0 开始，Phase 2 持续丰富
├── adapter.ts                       Phase 0 第 3 周
├── source.ts                        Phase 2 第 11 周
├── approximate.ts                   Phase 0 第 4 周
├── extend.ts                        Phase 1 第 7 周
└── fingerprint.ts                   Phase 1 第 5 周

apps/evolution/src/                  Phase 0 第 4 周搭起，Phase 2 完善
├── index.ts                         Phase 0 第 4 周
├── server.ts                        Phase 0 第 4 周
├── daemon.ts                        Phase 2 第 11 周
└── dashboard.ts                     Phase 2 第 15 周
```

---

## 风险与应对

| 风险 | 信号 | 归属 | 应对 |
|------|------|------|------|
| Phase 0 做完没人用 | demo 后无人主动尝试 | 📊 | 找一个"第一用户"一对一陪跑 |
| Extension 成功率太低 | Phase 1 成功率 < 30% | 📊 | 降低扩展粒度，增加 few-shot |
| DomainAdapter 接口不够用 | 第二领域需要改 `packages/evolution` | 🔧 | 接受并记录，修正抽象 |
| 团队觉得是个人项目 | 无人贡献 Pro Code | 📊 | Dashboard 上墙，周会展示 |
| 框架和用例耦合 | `packages/bi` import `packages/evolution` 的非导出成员 | 🔧 | 严格只通过 adapter 接口交互 |

---

*Framework 定义学习如何发生。Use Case 定义学什么。Knowledge 记录学到了什么、学不到什么。三者清晰分离，各自演进。*