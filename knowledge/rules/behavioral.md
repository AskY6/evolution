# BI 行为比较规则（Behavioral Comparison Rules）

## 概述

BI 领域的行为比较基于**结构指纹（Behavioral Fingerprint）**。系统将图表的可观测行为分解为两个维度：

- **API 指纹** — 请求了什么数据（metrics, dimensions, filters, sort）
- **Render 指纹** — 如何展示数据（chartType, series, axis, 装饰元素）

比较器（Comparator）对两个指纹做深度结构 diff，产生 Gap（差异信号）。Gap 中每条 Discrepancy 都带有路径（path），例如 `render.chartType` 或 `api.metrics[0]`。

## 指纹结构

```typescript
interface BiFingerprint {
  api: {
    metrics: string[];        // 查询了哪些指标
    dimensions: string[];     // 按什么维度分组
    filters: { field, operator }[];  // 筛选条件
    sort?: { field, order };         // 排序
  };
  render: {
    chartType: string;        // 图表类型 (bar, line, ...)
    seriesCount: number;      // 系列数量
    seriesTypes: string[];    // 系列类型列表
    xAxisType: string;        // X 轴类型 (category, value, time)
    yAxisType: string;        // Y 轴类型
    hasTitle: boolean;        // 是否有标题
    hasLegend: boolean;       // 是否有图例
  };
}
```

## 严重性分类（Severity Classification）

BI 领域基于**路径前缀**确定 Gap 严重性，而非通用比较器的 "差异数量" 启发式。

| 路径前缀 | 严重性 | 原因 |
|----------|--------|------|
| `render.chartType` | Critical | 根本性的可视化范式差异 |
| `api.metrics` | Critical | 查错数据 = 错误结论 |
| `api.dimensions` | Major | 分组错误 = 分析角度错误 |
| `render.xAxisType` | Major | 改变数据解读方式 |
| `render.yAxisType` | Major | 改变数据解读方式 |
| `render.seriesCount` | Moderate | 影响数据覆盖度 |
| `render.seriesTypes` | Moderate | 影响数据覆盖度 |
| `api.filters` | Moderate | 影响数据范围 |
| `api.sort` | Moderate | 影响数据排序 |
| `render.hasTitle` | Minor | 装饰性元素 |
| `render.hasLegend` | Minor | 装饰性元素 |
| 未知路径 | Moderate | 默认 |

### 严重性序数（Severity Ordinal）

| 等级 | 序数 | 含义 |
|------|------|------|
| Minor | 1 | 外观差异，不影响数据理解 |
| Moderate | 2 | 可感知差异，影响展示质量 |
| Major | 3 | 结构性差异，核心行为偏离 |
| Critical | 4 | 根本性不匹配，Schema 缺少该概念 |

### 整体严重性

当 Gap 包含多条 Discrepancy 时，**取最大严重性**作为整体评估。例如：

- `render.hasTitle`(Minor) + `render.chartType`(Critical) → 整体 **Critical**
- `api.filters[0]`(Moderate) + `api.sort`(Moderate) → 整体 **Moderate**

## 阈值建议（Threshold Recommendation）

| 场景 | 推荐阈值 | 含义 |
|------|----------|------|
| 严格匹配（生产环境） | 1（Minor） | 仅允许装饰性差异 |
| 宽松匹配（开发调试） | 2（Moderate） | 允许数据范围/排序差异 |
| 结构容忍（探索阶段） | 3（Major） | 允许分组/轴类型差异 |

默认阈值为 **1（Minor）**：只有装饰性差异时才认为 Schema 是充分的。

## 示例

### 示例 1：Sufficient（充分）

专家图表带标题，系统图表无标题。

```
Gap: { render.hasTitle: true → false }
BI 严重性: Minor (序数 1)
阈值: 1 → Sufficient ✓
```

### 示例 2：Insufficient（不充分）

专家用折线图，系统生成了柱状图。

```
Gap: { render.chartType: "line" → "bar" }
BI 严重性: Critical (序数 4)
阈值: 1 → Insufficient ✗ → 触发 Extension 阶段
```

### 示例 3：多重差异

```
Gap: {
  render.chartType: "line" → "bar"    (Critical)
  render.hasTitle: true → false        (Minor)
  api.filters[0].field: "region" → ∅  (Moderate)
}
整体 BI 严重性: Critical (取最大)
```
