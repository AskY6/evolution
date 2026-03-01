# Evolution Engine 训练工作台 — 产品设计 + 技术设计

---

## 一、定位

训练工作台是 Evolution Engine 框架**自带的**可视化界面。它不是一个独立产品，而是框架能力的一部分。任何领域接入框架后，自动获得一个可用的训练工作台，无需自行开发 UI。

一句话定位：**让领域训练者看见系统"懂什么"和"不懂什么"，并用最少的操作教会它新东西。**

---

## 二、用户角色

工作台面向三种角色，但共享同一个界面，通过使用模式自然区分。

### 领域训练者（主要用户）

通常是团队中最资深的那个人。他不一定写代码，但他掌握领域知识。他的目标是把自己脑子里的东西"教给"系统。

典型画像：BI 前端团队的 leader。他知道什么图表适合什么场景、什么配置组合是好的实践、什么是团队反复踩坑的陷阱。

他关心的问题：

- 系统现在能做什么？（能力边界在哪）
- 我给它看一个新例子，它能学会吗？（进化是否成功）
- 哪些东西它总学不会？（我的精力应该花在哪）

### 普通用户

团队里的其他成员。他们不训练系统，只使用系统产出的能力。他们可能偶尔用试验台来验证系统是否支持某个配置。

他们关心的问题：

- 这个意图系统能理解吗？（试验台）
- 系统最近学会了什么新东西？（版本管理）

### 系统管理者

关心系统整体运行状态的人。可能和训练者是同一个人。

他关心的问题：

- 进化成功率趋势如何？（边界视图）
- 有哪些候选扩展等待审核？（版本管理）
- 需不需要回滚？（版本管理）

---

## 三、用例

### UC-1：投喂示范

**触发**：训练者拿到一段专家代码（来自自己或团队成员），想让系统"认识"这个做法。

**流程**：

1. 训练者打开示范库，点击"添加示范"
2. 粘贴代码或配置，填写简短描述
3. 系统自动执行代码 → 提取行为指纹 → 与当前 Schema 比对
4. 系统标记该示范为"Schema 内"（当前框架可表达）或"Schema 外"（需要扩展）
5. 示范被存入示范库，可供后续训练使用

**关键体验**：训练者不需要知道 Schema 是什么，系统自动完成分类。他只需要不断投喂好的例子。

### UC-2：测试当前能力

**触发**：训练者（或普通用户）想知道系统能不能处理某个需求。

**流程**：

1. 打开试验台，用自然语言或配置描述意图
2. 系统运行 Approximate → Validate → Compile → Execute 全链路
3. 界面展示完整结果链：
   - Instance（系统的理解）
   - Executable（编译产物）
   - 行为指纹（执行结果的结构化摘要）
   - 预览（如果领域适配器提供了 preview 能力）
4. 如果失败，展示具体原因（缺少哪些概念），并提供"去训练场教它"的入口

**关键体验**：用户能看到从意图到结果的每一步中间产物，理解系统是"怎么理解的"，而不只是看到最终输出。

### UC-3：教系统新东西

**触发**：训练者有一个系统当前做不到的示范（标记为"Schema 外"），想尝试让系统学会。

**流程**：

1. 在训练场选择一个 Schema 外的示范
2. 点击"开始进化"，系统运行完整 Evolution Pipeline
3. 界面实时展示：
   - 进化日志（终端风格，显示每个阶段和迭代）
   - 当前阶段（Approximation / Extension / Codification）
4. 完成后展示对比视图：
   - 左栏：专家行为（目标）——指纹 + 预览
   - 中栏：Gap（结构化差异）
   - 右栏：系统行为（当前）——指纹 + 预览
5. 如果成功：展示 Schema Diff（新增了什么概念），提供"Promote"按钮
6. 如果失败：展示失败原因，标记为 NEEDS_HUMAN_REVIEW

**关键体验**：对比视图让训练者能直观判断"学得对不对"，而不只是看到一个"成功/失败"。Promote 的决定权在训练者手里。

### UC-4：审视边界

**触发**：积累了一批进化案例后，训练者想了解全局。

**流程**：

1. 打开边界视图
2. 看到三个核心数字：总进化次数、自动内化数、需人工干预数
3. 按知识类型分布的进度条（例：图表类型扩展 4/5 自动，业务语义判断 0/3 自动）
4. 系统生成的"边界洞察"文字总结

**关键体验**：训练者能快速回答"我的精力应该花在哪"。系统自动内化率高的类型不用管，低的才需要重点关注。

### UC-5：发布新能力

**触发**：训练者确认某次进化结果正确，想让团队用上。

**流程**：

1. 在训练场或版本管理中点击"Promote"
2. 系统将 CandidateSchema 合入正式 Schema，版本号递增
3. 版本历史更新，展示 diff
4. 新版本自动生效，后续请求使用新 Schema

**关键体验**：发布是一个显式的、可回滚的操作。训练者有信心发布，因为他在对比视图里已经验证过行为等价性。

---

## 四、界面结构

### 整体布局

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────┐ │
│ │          │ │                                 │ │
│ │ 侧边导航 │ │          主内容区                │ │
│ │          │ │                                 │ │
│ │ △ 示范库 │ │  根据当前选中的导航项切换        │ │
│ │ ▷ 试验台 │ │                                 │ │
│ │ ◈ 训练场 │ │                                 │ │
│ │ ◐ 边界   │ │                                 │ │
│ │ ◇ 版本   │ │                                 │ │
│ │          │ │                                 │ │
│ │ ──────── │ │                                 │ │
│ │ Schema   │ │                                 │ │
│ │ v0.3.1   │ │                                 │ │
│ └──────────┘ └─────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

侧边栏固定 220px，底部显示当前 Schema 版本。主内容区最大宽度 880px，居中。

### 各区域详细设计

**示范库**

```
┌─────────────────────────────────────────────┐
│ 示范库                        [+ 添加示范]  │
│ 专家的做法都在这里                           │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ ▍标准柱状图 - 月度销售额                │ │
│ │  bar | 1 series | category-axis  Schema内│ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ ▍折线图 - 用户增长趋势                  │ │
│ │  line | 1 series | smooth        Schema内│ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ ▍热力图 - 用户活跃时段                  │ │
│ │  heatmap | visualMap | 2d-grid   Schema外│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

每个示范卡片：左侧色条标记 Schema 内/外（绿/橙），右侧标签，底部显示行为指纹（monospace）。点击卡片跳转试验台或训练场。

**试验台**

```
┌─────────────────────────────────────────────┐
│ 试验台                                       │
│ 输入意图，看系统产出什么                       │
├─────────────────────────────────────────────┤
│ ┌────────────────────────────┐ [试一试]      │
│ │ 各部门季度销售额的柱状图   │              │
│ └────────────────────────────┘              │
├─────────────────────────────────────────────┤
│                                             │
│ 意图 → Instance → 编译 → 执行 → 行为指纹    │
│                                    Schema可表达│
│                                             │
│ ┌── Instance ─────────────────────────────┐ │
│ │ { "type": "bar", "metrics": [...] }     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌── 编译产物 ──────┐ ┌── 行为指纹 ────────┐ │
│ │ { xAxis: {...},  │ │ API  revenue×month │ │
│ │   series: [...] }│ │ 渲染 bar | 1 serie│ │
│ └──────────────────┘ └────────────────────┘ │
│                                             │
│ ┌── 预览 ─────────────────────────────────┐ │
│ │                                         │ │
│ │        ┃         ┃                      │ │
│ │    ┃   ┃     ┃   ┃                      │ │
│ │    ┃   ┃     ┃   ┃   ┃                  │ │
│ │   ─┸───┸─────┸───┸───┸──               │ │
│ │   1月  2月   3月  4月  5月               │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

链路流展示（一行小字）让用户知道经过了哪些步骤。预览区域由领域适配器的 `preview.render` 提供内容，框架提供容器。如果 adapter 未实现 preview，预览区域不显示，退化为纯文本模式。

**训练场**

```
┌─────────────────────────────────────────────┐
│ ← 返回   热力图 - 用户活跃时段    [进化中]  │
├─────────────────────────────────────────────┤
│ ┌── 进化日志 ─────────────────────────────┐ │
│ │ 14:23:01 Approximate（用旧框架逼近）    │ │
│ │ 14:23:02 Validate → Compile → Execute   │ │
│ │ 14:23:03 Compare（暴露 Gap）            │ │
│ │ ── 迭代 1/3 ──                          │ │
│ │ 14:23:04   Extend（扩展框架）           │ │
│ │ 14:23:05   ValidateC → CompileC         │ │
│ │ 14:23:06   Execute（执行候选）          │ │
│ │ 14:23:06   Compare（验证等价性）        │ │
│ │ ── 迭代 2/3 ──                          │ │
│ │ ...                                     │ │
│ │ ✓ 行为等价，收敛成功 ▌                  │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ ┌─ 专家行为 ──┐┌── Gap ───┐┌─ 系统行为 ──┐ │
│ │ 行为指纹    ││ 差异描述  ││ 行为指纹    │ │
│ │ heatmap |   ││ Gap 已消除││ heatmap |   │ │
│ │ visualMap   ││           ││ visualMap   │ │
│ │             ││           ││ ✓ 行为等价  │ │
│ │ ┌─ 预览 ──┐││           ││ ┌─ 预览 ──┐ │ │
│ │ │ (热力图) │││           ││ │ (热力图) │ │ │
│ │ └─────────┘││           ││ └─────────┘ │ │
│ └────────────┘└───────────┘└────────────┘ │
├─────────────────────────────────────────────┤
│ ┌── Schema 扩展 ──────────────────────────┐ │
│ │ + heatmap.radius: number                │ │
│ │ + heatmap.colorRange: string[]          │ │
│ │ + visualMap: VisualMapConfig            │ │
│ │                                         │ │
│ │ [Promote 到正式版本]  [暂不发布]         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

核心交互是三栏对比视图。预览嵌在左右栏内部，让训练者直观对比"专家做出来的样子"和"系统做出来的样子"。Gap 栏在中间，宽度较窄，只展示结构化差异。

**边界视图**

```
┌─────────────────────────────────────────────┐
│ 边界视图                                     │
│ 你的边界地图                                  │
├─────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │    17    │ │     8    │ │     9    │     │
│ │ 总进化数 │ │ 自动内化 │ │ 需人工   │     │
│ └──────────┘ └──────────┘ └──────────┘     │
├─────────────────────────────────────────────┤
│ 按知识类型分布                                │
│                                             │
│ 图表类型扩展    ████████████████░░░░  4/5   │
│ 交互模式        █████░░░░░░░░░░░░░░  1/3   │
│ 数据处理逻辑    ████████████████░░░░  3/4   │
│ 业务语义判断    ░░░░░░░░░░░░░░░░░░░  0/3   │
│ 布局与样式      ░░░░░░░░░░░░░░░░░░░  0/2   │
│                                             │
│ ┌── 边界洞察 ─────────────────────────────┐ │
│ │ 结构性配置的自动内化率在 75% 以上。      │ │
│ │ 涉及审美和业务语义的知识几乎全需人工。   │ │
│ │ 当前边界：能学会"怎么做"，学不会"该不该做"│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**版本管理**

```
┌─────────────────────────────────────────────┐
│ 版本管理                                     │
├── 待审核 ───────────────────────────────────┤
│ ▍漏斗图支持   v0.3.1 · 3扩展  [Promote]    │
│ ▍地图下钻     v0.3.1 · 5扩展  [Promote]    │
├── 版本历史 ─────────────────────────────────┤
│ ● v0.3.1  +桑基图, +雷达图        2天前 当前│
│ ○ v0.3.0  +热力图, +visualMap      1周前    │
│ ○ v0.2.0  +饼图, +tooltip 自定义   3周前    │
│ ○ v0.1.0  柱状图, 折线图, 筛选器   6周前    │
└─────────────────────────────────────────────┘
```

---

## 五、界面之间的跳转关系

```
               点击示范
示范库 ──────────────────→ 试验台
  │                          │
  │ Schema 外的示范          │ "去训练场教它"
  │                          │
  ↓                          ↓
训练场 ←─────────────────────┘
  │
  │ Promote
  ↓
版本管理

边界视图 ← 所有面板的进化结果汇总，无主动跳转入口
```

核心路径：**示范库 → 试验台 → 训练场 → 版本管理**。这条路径对应"投喂 → 测试 → 训练 → 发布"的自然工作流。边界视图是旁观者，定期查看。

---

## 六、技术设计

### 6.1 工作台在项目中的位置

```
packages/evolution/src/
├── types/
├── pipelines/
├── actions/
├── ...
└── workbench/                   ← 框架自带
    ├── index.tsx                 # 入口组件，接受 adapter
    ├── layout/
    │   ├── Shell.tsx             # 整体布局：侧边栏 + 主内容区
    │   └── Nav.tsx               # 导航项
    ├── panels/
    │   ├── DemoLibrary.tsx       # 示范库
    │   ├── Playground.tsx        # 试验台
    │   ├── TrainingGround.tsx    # 训练场
    │   ├── BoundaryView.tsx      # 边界视图
    │   └── VersionPanel.tsx      # 版本管理
    ├── shared/
    │   ├── Card.tsx
    │   ├── Tag.tsx
    │   ├── Terminal.tsx          # 终端风格日志
    │   ├── SplitDiff.tsx         # 三栏对比视图
    │   ├── PreviewSlot.tsx       # 预览插槽容器
    │   └── PipelineFlow.tsx      # 管线步骤可视化
    └── hooks/
        ├── usePipeline.ts        # 管线运行状态管理
        ├── useDemos.ts           # 示范库 CRUD
        └── useSchemaRegistry.ts  # Schema 版本读取
```

工作台是 `packages/evolution` 的一部分，和类型定义、管线逻辑平级。它不是一个独立的 app。

### 6.2 入口接口

```typescript
// packages/evolution/src/workbench/index.tsx

import { DomainAdapter } from '../adapter'
import { SchemaRegistry } from '../schema-registry'
import { EvolutionEngine } from '../pipelines/evolution'

interface WorkbenchProps {
  adapter: DomainAdapter
  registry: SchemaRegistry
  engine: EvolutionEngine
}

export function Workbench({ adapter, registry, engine }: WorkbenchProps) {
  // 组装所有 panel，注入依赖
  // adapter.preview?.render 被传递给 PreviewSlot
}
```

领域侧的使用方式：

```typescript
// apps/evolution/src/index.ts

import { Workbench } from '@evolution/core/workbench'
import { biAdapter } from '@evolution/bi'
import { createRegistry, createEngine } from '@evolution/core'

const registry = createRegistry('./knowledge/schema')
const engine = createEngine({ adapter: biAdapter, registry })

// 一行代码挂载
<Workbench adapter={biAdapter} registry={registry} engine={engine} />
```

### 6.3 预览插槽机制

预览是工作台中唯一的领域特化点。通过 `DomainAdapter.preview` 实现。

```typescript
// adapter 接口扩展
interface DomainAdapter {
  compile:     (instance: Instance) => Either<CompileError, Executable>
  compileC:    (candidate: CandidateInstance) => CompileResult
  execute:     (executable: Executable) => Either<ExecuteError, Behavior>
  fingerprint: (raw: unknown) => Behavior
  runtime:     () => RuntimeCapability

  // 可选：执行结果的可视化
  preview?: {
    render: (executable: Executable) => PreviewConfig
  }
}

type PreviewConfig =
  | { type: 'html';    content: string }       // 嵌入 HTML 片段
  | { type: 'json';    data: unknown }         // 格式化 JSON 树
  | { type: 'iframe';  url: string }           // 嵌入沙箱页面
  | { type: 'image';   url: string }           // 展示图片/SVG
  | { type: 'custom';  component: ReactNode }  // 完全自定义
```

**PreviewSlot 组件**：

```typescript
// packages/evolution/src/workbench/shared/PreviewSlot.tsx

interface PreviewSlotProps {
  executable: Executable
  adapter: DomainAdapter
  fallback?: ReactNode  // preview 不存在时的降级展示
}

function PreviewSlot({ executable, adapter, fallback }: PreviewSlotProps) {
  if (!adapter.preview) {
    // 降级：显示 Executable 的 JSON
    return fallback ?? <JsonView data={executable} />
  }

  const config = adapter.preview.render(executable)

  switch (config.type) {
    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: config.content }} />
    case 'json':
      return <JsonView data={config.data} />
    case 'iframe':
      return <iframe src={config.url} sandbox="allow-scripts" />
    case 'image':
      return <img src={config.url} />
    case 'custom':
      return config.component
  }
}
```

**各领域的预览实现示例**：

```typescript
// BI 场景：ECharts 图表预览
const biAdapter: DomainAdapter = {
  // ...compile, execute, fingerprint, runtime
  preview: {
    render: (executable) => ({
      type: 'iframe',
      url: `/sandbox/echarts?option=${encodeURIComponent(JSON.stringify(executable))}`,
    }),
  },
}

// 表单场景：表单渲染预览
const formAdapter: DomainAdapter = {
  // ...
  preview: {
    render: (executable) => ({
      type: 'html',
      content: renderFormToHTML(executable),
    }),
  },
}

// 审批流场景：流程图预览
const workflowAdapter: DomainAdapter = {
  // ...
  preview: {
    render: (executable) => ({
      type: 'image',
      url: renderBPMNToSVG(executable),
    }),
  },
}

// 最简场景：不提供 preview，退化为 JSON 展示
const minimalAdapter: DomainAdapter = {
  // ...compile, execute, fingerprint, runtime
  // 不实现 preview，工作台自动降级
}
```

### 6.4 数据流

工作台不管理持久化状态。它通过三个注入的依赖获取和修改数据：

```
                ┌─────────────┐
                │  Workbench  │
                └──────┬──────┘
                       │
           ┌───────────┼───────────┐
           ↓           ↓           ↓
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ adapter  │ │ registry │ │  engine  │
    └──────────┘ └──────────┘ └──────────┘
     领域绑定      Schema 版本   管线运行
```

**adapter**：提供 compile / execute / fingerprint / preview。工作台调用这些方法来运行管线和渲染预览。

**registry**：提供 Schema 的读取、版本列表、Promote、Rollback。工作台通过它展示版本历史和执行 Promote。

**engine**：提供管线的运行入口（runApproximation, runExtension, runEvolution）。工作台通过它触发进化并订阅进度事件。

### 6.5 管线运行与进度订阅

训练场需要实时展示进化日志。engine 通过事件流暴露进度：

```typescript
interface EvolutionEngine {
  // 运行完整进化，返回结果
  runEvolution: (demo: Demonstration) => Promise<EvolutionOutcome>

  // 订阅进度事件（用于 UI 实时展示）
  onProgress: (callback: (event: PipelineEvent) => void) => Unsubscribe
}

type PipelineEvent =
  | { type: 'phase_start';  phase: string; timestamp: number }
  | { type: 'phase_end';    phase: string; timestamp: number }
  | { type: 'iteration';    current: number; max: number }
  | { type: 'gap_found';    gap: Gap }
  | { type: 'candidate';    schema: CandidateSchema }
  | { type: 'converged';    iterations: number }
  | { type: 'failed';       reason: string }
```

工作台的 `usePipeline` hook 消费这些事件，转换为 Terminal 组件的日志行：

```typescript
function usePipeline(engine: EvolutionEngine) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<EvolutionOutcome | null>(null)

  const run = async (demo: Demonstration) => {
    setRunning(true)
    setLogs([])
    setOutcome(null)

    const unsub = engine.onProgress((event) => {
      setLogs(prev => [...prev, eventToLogLine(event)])
    })

    const result = await engine.runEvolution(demo)
    unsub()
    setOutcome(result)
    setRunning(false)
  }

  return { logs, running, outcome, run }
}
```

### 6.6 对比视图的数据结构

SplitDiff 组件接收的数据：

```typescript
interface DiffViewData {
  expert: {
    behavior: Behavior           // 专家的行为指纹
    executable: Executable       // 专家的可执行物（用于 preview）
    source?: string              // 专家原始代码（可选展示）
  }
  system: {
    behavior: Behavior           // 系统的行为指纹
    executable: Executable       // 系统的可执行物（用于 preview）
  } | null                       // 系统未能产出时为 null
  gap: Gap | null                // 差异（成功时为 null）
}
```

对比视图内部分三栏：

- 左栏调用 `<PreviewSlot executable={expert.executable} />` + 指纹展示
- 中栏展示 `gap` 的结构化内容
- 右栏调用 `<PreviewSlot executable={system.executable} />` + 指纹展示

两侧 preview 使用相同的 adapter.preview.render，确保视觉一致性。

### 6.7 降级策略

| adapter 提供了什么 | 工作台表现 |
|---|---|
| 完整实现（含 preview） | 所有区域完整可用，试验台和训练场有可视化预览 |
| 不含 preview | 所有区域可用，预览区域退化为 JSON 格式化展示 |
| 不含 runtime | CompileC 无法区分 Blocked/Degraded，统一报 CompileError |

工作台永远可用。preview 是增强，不是前提。

---

## 七、设计原则

**1. 框架提供骨架，领域填充血肉。** 工作台的布局、交互流程、对比视图结构是固定的。领域只通过 adapter 接口注入内容，不修改 UI 结构。

**2. 预览是奖励，不是门槛。** 即使领域适配器只实现了四个核心方法（compile, execute, fingerprint, runtime），工作台也完全可用。preview 只是让体验更好。

**3. 透明优先于简洁。** 试验台不只展示最终结果，而是展示从意图到结果的完整链路（Instance → Executable → Behavior）。训练者需要理解系统"怎么想的"，才能判断"想得对不对"。

**4. 失败和成功一样重要。** 训练场的失败案例不是错误状态，而是有价值的数据点。它们会自动进入边界视图的统计。NEEDS_HUMAN_REVIEW 不是报错，是"这里需要你"。

**5. Promote 的决定权在人。** 系统可以自动完成进化，但发布到正式版本必须由训练者显式确认。这是确定性与非确定性隔离在产品层面的体现。