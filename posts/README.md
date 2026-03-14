# 黑板报文章目录

本目录包含黑板报（内部技术分享）的所有文章，按类型组织如下：

## 黑板报（Bulletin）- 内部快讯

1. [共同构建开放有活力的的技术体系](./open-tech-ecosystem.md) - 2026-01-24
   - 关于内部开放、外部协作和落地机制的思考

2. [AI+产品：克制才是长期竞争力](./ai-plus-product.md) - 2026-01-24
   - AI在丰图产品体系中的正确定位和应用策略

3. [AI+ Engineer：从共识到现实的三年进化](./ai-engineer-evolution.md) - 2026-01-24
   - AI对工程师生产力的影响和变化趋势

## 技术趋势（Tech Trends）

1. [多模态地图理解：从像素到语义的跨越](./multimodal-map-understanding.md)
   - Vision Transformer与地图领域知识的结合

2. [边缘原生渲染：把地图计算搬到用户端](./edge-native-rendering.md)
   - WebGPU加速和端侧推理的地图渲染方案

3. [实时空间计算：让数据在流动中产生价值](./realtime-spatial-computing.md)
   - 时空索引和流式计算引擎的应用

4. [生成式地图体验：用自然语言编排地图场景](./generative-map-experience.md)
   - NL→DSL的地图场景自动生成

## 产品故事（Product Stories）

1. [开放平台 3.0：从 API 到能力网格](./open-platform-3-0.md)
   - REST API向细粒度能力单元的演进

2. [私网地图：安全与体验的平衡](./private-network-map.md)
   - 隔离环境下的地图服务方案

3. [空间智能Lab：从地图到知识图谱](./spatial-intelligence-lab.md)
   - 地理实体知识图谱和推理能力

4. [数据工厂：从手工作坊到自动化流水线](./data-factory.md)
   - 地图数据生产的自动化和质量管理

## 行业展望（Outlooks）

1. [AI Native 地图范式：重新定义地图体验](./ai-native-map-paradigm.md)
   - 地图与AI融合的未来趋势

2. [隐私与合规优先：打造空间数据的安全基建](./privacy-and-compliance.md)
   - 隐私计算和数据合规的重要性

3. [场景化运营：从通用地图到行业套件](./scenario-based-operations.md)
   - 行业解决方案的包装和交付方式

## 使用说明

所有文章均为Markdown格式，可以直接在编辑器中查看和编辑。

在BlackboardPage.tsx中，这些文章通过导入相应的Markdown文件进行使用：

```tsx
import multimodalMapUnderstanding from '../articles/multimodal-map-understanding.md?raw'
```

使用`?raw`后缀以原始文本形式导入Markdown内容。
