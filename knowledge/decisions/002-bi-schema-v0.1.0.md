# 002 — BI Schema v0.1.0 设计

> 状态：已决定
> 日期：2026-02-27

---

## 背景

第一版 BI Schema 需要覆盖最常见的可视化需求，同时保持足够简单以验证整条管线（parse → compile → execute → compare）。选择柱状图和折线图作为起点，因为它们是 BI 场景中最高频的图表类型。

## Schema 结构

Schema id: `bi`, version: `0.1.0`

### 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `chartType` | `"bar" \| "line"` | 是 | 图表类型 |
| `title` | `string` | 否 | 图表标题 |
| `dataSource` | `object` | 是 | 数据查询配置 |
| `dataSource.metrics` | `string[]` (≥1) | 是 | 度量字段 |
| `dataSource.dimensions` | `string[]` (≥1) | 是 | 维度字段 |
| `dataSource.filters` | `Filter[]` | 否 | 筛选条件 |
| `dataSource.sort` | `{ field, order }` | 否 | 排序 |
| `xAxis` | `{ field, label? }` | 是 | X 轴配置 |
| `yAxis` | `{ field, label? }` | 是 | Y 轴配置 |
| `series` | `Series[]` (≥1) | 是 | 数据系列 |

### Filter 运算符

`=`, `!=`, `>`, `<`, `>=`, `<=`, `in`

### 编译目标

Instance → ECharts Option JSON，包括：
- `xAxis.type: "category"`, `yAxis.type: "value"`
- 多系列时自动生成 legend
- 系列颜色通过 `itemStyle.color` 传递

## 边界

### v0.1.0 支持

- 柱状图（bar）、折线图（line）
- 单/多系列
- 基础筛选器（7 种运算符）
- 单字段排序
- 标题、图例

### v0.1.0 不支持（未来扩展方向）

- 饼图、散点图、雷达图等其他图表类型
- 双轴图表（左右 Y 轴）
- 数据聚合函数（sum, avg, count 等）
- 时间轴
- 交互行为（drill-down, tooltip 自定义）
- 主题/样式系统

## 样本

8 个手写 Instance 样本覆盖以下场景：
1. 简单柱状图（月度收入）
2. 折线图（用户增长趋势）
3. 带筛选的柱状图（按地区过滤）
4. 多系列柱状图（收入 vs 成本）
5. 带排序的折线图（产品销量排名）
6. IN 运算符筛选
7. 多条件筛选
8. 最小化柱状图（无标题、无筛选、无排序）

## 验证

所有 8 个样本通过 Instance → compile → execute → fingerprint 全链路测试。
