export default class LoadingAction {
    element: HTMLElement|SVGElement;
    actionName: string;
    arg: string;
    delay = 0;

    constructor(element: HTMLElement|SVGElement, actionName: string, arg = '', delay = 0) {
        this.element = element;
        this.actionName = actionName;
        this.arg = arg;
        this.delay = delay;
    }

    calculateKey(): string {
        return `${this.actionName}(${this.arg})`;
    }
}
