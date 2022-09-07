import BackendRequest from "./BackendRequest";

export default class LoadingCoordinator {
    readonly loadingElements: Map<HTMLElement|SVGElement, ElementLoadingActions>

    addElementAction(element: HTMLElement|SVGElement, initiator: BackendRequest, actionName: string, arg = ''): void {
        const loadingActions = this.loadingElements.get(element) || new ElementLoadingActions(element);
        loadingActions.addAction(initiator, actionName, arg);
    }

    removeElementAction(element: HTMLElement|SVGElement, initiator: BackendRequest, actionName: string, arg = ''): boolean {
        const loadingActions = this.loadingElements.get(element) || new ElementLoadingActions(element);

        return loadingActions.removeAction(initiator, actionName, arg);
    }
}

class ElementLoadingActions {
    readonly element: HTMLElement|SVGElement;
    readonly actions: Map<string, Array<BackendRequest>>

    constructor(element: HTMLElement|SVGElement) {
        this.element = element;
    }

    /**
     * @param actionName the "action" to perform on loading, like "show"
     * @param arg        an optional argument (e.g. class name) to go with the action
     * @param initiator  the ReRenderPromise that is causing this loading state
     */
    addAction(initiator: BackendRequest, actionName: string, arg = ''): void {
        const key = this.#calculateKey(actionName, arg);

        const initiators = this.actions.get(key) || [];
        initiators.push(initiator);

        this.actions.set(key, initiators);
    }

    /**
     * Returns true if no other initiator is still triggering this action.
     * This means that it is now safe to execute the "reverse" of the action.
     *
     * @returns bool
     */
    removeAction(initiator: BackendRequest, actionName: string, arg = ''): boolean {
        const key = this.#calculateKey(actionName, arg);

        const initiators = this.actions.get(key) || [];
        const index = initiators.indexOf(initiator);
        if (index > -1) {
            initiators.splice(index, 1);
        }

        return initiators.length === 0;
    }

    #calculateKey(actionName: string, arg: string): string {
        return `${actionName}(${arg})`;
    }
}
