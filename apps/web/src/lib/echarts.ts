import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

// Only the pieces the dashboard and report charts need, so the bundle stays small.
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, SVGRenderer]);

export { echarts };
export type ChartOption = EChartsCoreOption;
