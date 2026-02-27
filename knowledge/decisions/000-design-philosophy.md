# DSL Evolution Engine — 抽象设计理念

> "把别人的手艺变成自己的能力"

---

## 1 问题本质

系统的起点是一个简单的事实：**专家会做某件事，系统不会。**

专家的知识锁在代码里，无法复用、无法泛化。我们要做的是观察专家怎么做，理解他做了什么，把这个理解沉淀成规则，然后让系统自己也能做同样的事，甚至举一反三。

这本质上是一个**知识内化**的过程，和人类学习的路径一模一样：**模仿 → 理解 → 抽象 → 掌握。**

---

## 2 三个原语

剥离所有技术词汇，整个系统只有三个不可分割的操作。

### 2.1 示范（Demonstration）

外部专家产出了一个**具体行为**。这个行为是不透明的——你能观测到它做了什么（行为指纹），但不直接知道它为什么这么做（意图结构）。

> 类比：你看一个老师傅做了一道菜，你能尝到味道，能看到他出锅的顺序，但他脑子里的决策逻辑你看不到。

### 2.2 内化（Internalization）

系统试图用**自己的语言**重新表达这个行为。"自己的语言"就是系统当前的认知框架（Schema）。内化有两种结果：

- **可表达**：当前框架足够描述这个行为。只需要产出一个新的实例。
- **不可表达**：当前框架缺少必要的概念。框架本身需要扩展。

> 类比：一个只学过煎炒的厨师看到有人做分子料理。他无法用"煎炒"的语言描述"球化"这个操作——他需要先发明一个新概念。

### 2.3 固化（Codification）

当系统成功用新框架表达了行为，并验证了行为等价性后，新框架取代旧框架，成为系统的**"新常识"**。

> 类比：厨师把"球化"写进了自己的食谱体系，从此这不再是新技巧，而是基本功的一部分。

---

## 3 核心张力

三个原语之间存在一个结构性矛盾：

> **内化需要一个稳定的框架来对照，但内化的结果恰恰是要改变这个框架。**

更精确地说：

- 你需要用**现有 Schema** 去理解专家行为（否则没有对照基准）
- 但专家行为可能**超出现有 Schema**（否则不需要学习）
- 所以你必须在**"用旧框架理解"和"突破旧框架"之间同时工作**

这不是工程问题，这是**认识论问题**。任何学习系统都面临同样的困境。它对应的是 Piaget 认知发展理论中的两个概念：

- **Assimilation（同化）**：用已有框架理解新事物
- **Accommodation（顺应）**：改变框架本身以适应新事物

---

## 4 解决方案：两阶段拆分

解决核心张力的关键是把一次内化拆成两个**性质完全不同**的阶段，而不是混在一起。

### 4.1 阶段 A：逼近（Approximation）

先不管框架够不够，强制用现有 Schema 产出一个"最近似"的实例。这一步的目标不是正确，而是**暴露差异**。差异本身就是信息——它精确地告诉你"旧框架缺了什么"。

**关键性质**：输入输出都在 Current 框架内，完全可验证。

### 4.2 阶段 B：扩展（Extension）

拿到差异后，**只针对差异本身**做最小扩展。每次扩展只回答一个问题：要消除这个具体的差异，框架最少需要加什么？

**关键性质**：输出超出 Current 框架，进入 Candidate 框架，需要新的验证手段。

### 为什么必须拆开

A 的输入输出都在旧框架内，完全可验证；B 的输出超出旧框架，需要新的验证手段。把它们混在一起，你就不知道一个错误到底是"A 没做好"还是"B 的方向错了"。

---

## 5 类型系统：Current 与 Candidate 的结构性区分

系统中的所有实体都按照"当前 / 候选"进行**结构性区分**，而不是简单的标签。

### Schema 与 CandidateSchema

**Schema** 是稳定的、被信任的、所有 Instance 的合法性基准。

**CandidateSchema** 不是一个独立的框架，而是从某个确定的 `baseSchema` 上"长出来"的，携带了 `extensions` 扩展部分。这意味着你永远能回答"这次扩展是相对于什么基线"，也永远能回滚。

### Instance 与 CandidateInstance

**Instance** 的每个字段都能在 Schema 中找到定义。

**CandidateInstance** 有两个 Payload：`basePayload`（旧框架能描述的部分）和 `extensionPayload`（新概念带来的部分）。这个拆分让你在 Promote 时能精确知道哪些内容需要迁移，哪些已经稳定。

### Compile 的签名不对称

对 Instance 的编译返回 `Either<CompileError, Executable>`——因为已被 Runtime 支持过的 Schema，编译只可能因 bug 失败。

对 CandidateInstance 的编译返回 `CompileResult（Compiled | Blocked | Degraded）`——候选实例天然面临 Runtime 能力缺口。

这个签名差异直接体现了"Current 的世界是确定的，Candidate 的世界是不确定的"。

---

## 6 Candidate 与 Runtime 的关系

当一个 CandidateInstance 无法被执行时，原因只有两种：

- **逻辑层面的错误**：框架扩展本身是错的，应在内化流水线里修正。
- **物理层面的缺席**：框架扩展是对的，但 Runtime 还不具备执行能力。

因此 Compile 被拆成两步：

- **Validate**：纯逻辑校验，不涉及 Runtime
- **Compile**：能力映射，检查 Runtime 能否承载

Runtime 不是执行器本身，而是一份**能力声明**（RuntimeCapability），描述"我能做什么"。Feature 可以被分为三类：

| 状态 | 含义 | 处理方式 |
|------|------|----------|
| Supported | 已支持，直接编译 | 正常流程 |
| Feasible | 可扩展，但有成本 | 产出研发任务（RuntimeUpdateTask） |
| Unfeasible | 不可支撑 | 反压回 Extend，要求换方向 |

**Unfeasible 是认识论反馈**，它应该改变框架扩展的方向，和 Gap 一样是驱动迭代的信号。**Feasible 是工程任务**，它不改变框架，只改变 Runtime，本质上是给人类工程师的工单。

---

## 7 原子动作

所有动作都是纯函数签名，流水线只依赖签名，不依赖实现。

| 动作 | 签名 | 性质 |
|------|------|------|
| Approximate | Schema + Demo → Instance | 非确定性（AI） |
| Validate / ValidateC | Schema + Instance → Instance | 确定性 |
| Compile / CompileC | Runtime + Instance → Executable / CompileResult | 确定性 |
| Execute | Executable → Behavior | 确定性 |
| Compare | Behavior × Behavior → Gap | 确定性 |
| Extend | Schema + Gap + Demo → Candidate* | 非确定性（AI） |
| Promote | Candidate* + Memory → Memory′ | 确定性 |

**确定性部分**是产品——稳定、可信赖、可给用户承诺 SLA。

**非确定性部分**是研发管线——在后台运行，其产出在被 Promote 之前不影响任何用户。

---

## 8 流水线

### 8.1 内化流水线（Internalization Pipeline）

核心流水线，对应两阶段拆分。

**阶段 A：Approximation**

```
Approximate → Validate → Compile → Execute → Compare
```

所有类型都带 Current。产出 `Sufficient`（旧框架够用）或 `Insufficient`（携带 Gap 进入阶段 B）。

**阶段 B：Extension**

```
迭代循环：Extend → ValidateC → CompileC → Execute → Compare
```

产出 Candidate 类型。收敛则产出已验证的 CandidateSchema + CandidateInstance，不收敛则升级为人工干预。

**Runtime 约束的反压通道**：当 CompileC 返回 Blocked 时，约束被转换为 Gap 重新喂给 Extend。对 Extend 来说，"行为不对"和"运行时做不到"走同一个反馈通道。

### 8.2 固化流水线（Codification Pipeline）

Promote：将 extensions 合入 Schema，将 CandidateInstance 重写为新 Schema 下的 Instance，更新 Memory。

### 8.3 进化流水线（Evolution Pipeline）

完整编排：Internalization → Codification → Memory′。任一阶段失败则整体失败，不会产生半成品。

---

## 9 架构原则：确定性与非确定性的隔离

系统的终态是一个 **Schema 会自己长大的 DSL 编译器**，其中编译是确定性的，进化是 AI 驱动但验证把关的，用户只看到越来越强的编译产物。

> **用户永远只跑在确定性管线上。AI 推理的结果只有在通过验证并被固化之后，才会进入用户的世界。**

这意味着系统的产品形态是：

- **CLI / SDK**，被集成到别人的工作流里
- **Schema Registry**，管理知识库的版本、兼容性、迁移
- **Compiler Toolchain**，接受 Schema + Instance，产出可执行物
- **Evolution Daemon**，在后台消费专家行为的事件流，驱动内化和固化

---

## 10 独特性定位

这个系统横跨三个已有领域，但没有人把它们组合成这个结构。

| 维度 | 已有工作 | 本系统 |
|------|---------|--------|
| 进化什么 | Agent prompt / 代码实现 | 认知框架（Schema）本身 |
| 学习信号 | 评分 / 测试通过率 | 行为指纹的结构化差异（Gap） |
| 框架角色 | 固定不变 | 随学习动态扩展 |
| 验证标准 | 性能指标提升 | 行为等价 + 向后兼容 |
| 核心张力 | 探索 vs 利用 | 旧框架理解 vs 新框架突破 |

最接近的学术概念不在软件工程里，而在认知科学中——Piaget 的认知发展理论。Assimilation（同化）对应 Approximation 阶段，Accommodation（顺应）对应 Extension 阶段。

**本系统本质上是在尝试把 Piaget 的顺应过程工程化。**

---

*"观察专家怎么做，理解他做了什么，把理解沉淀成规则，让系统也能做。"*