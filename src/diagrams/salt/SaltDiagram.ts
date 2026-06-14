import { Diagram } from '../../core/Diagram';

export type WidgetType =
    | 'grid'
    | 'groupbox'
    | 'tabs'
    | 'menu'
    | 'tree'
    | 'scroll'
    | 'button'
    | 'checkbox'
    | 'radio'
    | 'input'
    | 'droplist'
    | 'separator'
    | 'sprite'
    | 'label';

export type LineStyle = 'none' | 'all' | 'vertical' | 'horizontal' | 'external';

export interface BaseWidget {
    type: WidgetType;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
}

export interface GridWidget extends BaseWidget {
    type: 'grid';
    lineStyle: LineStyle;
    rows: Widget[][];
}

export interface GroupBoxWidget extends BaseWidget {
    type: 'groupbox';
    title: string;
    content: Widget;
}

export interface TabWidget extends BaseWidget {
    type: 'tabs';
    tabs: string[];
    vertical: boolean;
    activeIndex: number;
}

export interface MenuWidget extends BaseWidget {
    type: 'menu';
    items: string[];
    openIndex?: number;
    dropdownItems?: string[];
}

export interface TreeNode {
    level: number;
    cells: Widget[];
}

export interface TreeWidget extends BaseWidget {
    type: 'tree';
    lineStyle: LineStyle;
    nodes: TreeNode[];
}

export interface ScrollWidget extends BaseWidget {
    type: 'scroll';
    horizontal: boolean;
    vertical: boolean;
    content: Widget;
}

export interface ButtonWidget extends BaseWidget {
    type: 'button';
    label: string;
}

export interface CheckboxWidget extends BaseWidget {
    type: 'checkbox';
    label: string;
    checked: boolean;
}

export interface RadioWidget extends BaseWidget {
    type: 'radio';
    label: string;
    checked: boolean;
}

export interface InputWidget extends BaseWidget {
    type: 'input';
    label: string;
}

export interface DroplistWidget extends BaseWidget {
    type: 'droplist';
    label: string;
    open: boolean;
    items?: string[];
}

export interface SeparatorWidget extends BaseWidget {
    type: 'separator';
    style: 'dotted' | 'double' | 'strong' | 'single';
    title?: string;
}

export interface SpriteRefWidget extends BaseWidget {
    type: 'sprite';
    name: string;
}

export interface LabelWidget extends BaseWidget {
    type: 'label';
    text: string;
}

export type Widget =
    | GridWidget
    | GroupBoxWidget
    | TabWidget
    | MenuWidget
    | TreeWidget
    | ScrollWidget
    | ButtonWidget
    | CheckboxWidget
    | RadioWidget
    | InputWidget
    | DroplistWidget
    | SeparatorWidget
    | SpriteRefWidget
    | LabelWidget;

export class SaltDiagram implements Diagram {
    type = 'salt';
    title?: string;
    header?: string;
    footer?: string;
    caption?: string;
    legend?: string;
    scale?: number;
    dpi?: number;
    backgroundColor?: string;
    handwritten = false;
    sprites = new Map<string, string[]>(); // name -> lines of pixels (. and X)
    root?: Widget;
}
