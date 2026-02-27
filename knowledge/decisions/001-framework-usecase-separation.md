# 001 — Framework 与 Use Case 的分离

> 状态：已决定
> 日期：2026-02-27

---

## 背景

DSL Evolution Engine 的核心挑战是：框架（"学习如何发生"）和用例（"学什么"）是两个独立的关注点，但它们在运行时密切协作。如果不从架构层面强制分离，领域特定逻辑会不可避免地泄漏到框架中，导致框架无法复用于第二个领域。

## 决策

### 包结构

```
packages/evolution/   — 框架（@evolution/core）
packages/bi/          — BI 用例（@evolution/bi）
apps/evolution/       — 应用层，组装两者
```

### 依赖规则

`packages/bi` → `packages/evolution` **只通过 `DomainAdapter` 接口交互**。

- `packages/bi` 可以 import `@evolution/core` 导出的类型和接口
- `packages/bi` 不可以 import `@evolution/core` 的内部模块
- `packages/evolution` 不可以 import `@evolution/bi` 的任何内容
- `apps/evolution` 可以 import 两者，负责组装和启动

### DomainAdapter 接口

这是唯一的集成点：

```typescript
interface DomainAdapter {
  compile:     (instance: Instance) => Either<CompileError, Executable>
  compileC:    (candidate: CandidateInstance) => CompileResult
  execute:     (executable: Executable) => Either<ExecuteError, Behavior>
  fingerprint: (raw: unknown) => Behavior
  runtime:     () => RuntimeCapability
}
```

框架通过这五个方法与领域交互，永远不会越过这个边界。

### 职责划分

| 关注点 | 框架 (`evolution`) | 用例 (`bi`) |
|--------|-------------------|-------------|
| Schema 结构定义 | FieldDefinition, Rule 类型 | 具体的 Schema 内容 |
| Instance 校验 | validator.ts（纯结构校验） | — |
| 编译 | 调用 adapter.compile | 实现 compile（Instance → ECharts Option） |
| 行为比对 | comparator.ts（结构化 diff） | 定义 fingerprint 的维度 |
| 管线编排 | pipelines/（全部阶段） | — |
| LLM prompt 策略 | 定义 Approximate/Extend 接口 | 实现 BI 特化的 prompt 策略 |

## 验证信号

- `packages/evolution/` 的 import 中没有出现 `@evolution/bi`
- `packages/bi/` 只 import `@evolution/core` 的导出类型和接口
- 第二个领域（Phase 3, Week 21-22）能仅实现 DomainAdapter 就接入框架

## 风险

如果 DomainAdapter 接口不够用（第二领域需要修改框架），接受并记录，修正抽象。每一次修正都应成为新的 decision 文档。
